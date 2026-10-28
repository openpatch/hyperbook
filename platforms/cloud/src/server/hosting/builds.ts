import { existsSync, mkdirSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { audit } from "../audit";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { books, builds } from "../db/schema";
import { checkout } from "./git";
import { BuildLog, type Runner, hyperbookVersion, sandboxedRunner } from "./runner";
import { buildDir, makeJobDir, repoDir } from "./storage";

export type BuildRow = typeof builds.$inferSelect;

/** Successful builds kept on disk besides the published and the preview one, for rollbacks. */
const KEEP_PREVIOUS = 2;
/** Build records (with logs) kept per book. */
const KEEP_RECORDS = 50;
/** How often a running build's log is written to the database. */
const LOG_INTERVAL_MS = 1000;

type Running = { buildId: number; bookId: number; abort: AbortController; log: BuildLog };

/**
 * The build queue: one per process, persisted in the builds table so a
 * restart picks up where it stopped. At most `concurrency` builds run at once,
 * never two of the same book.
 */
export class BuildQueue {
  private running = new Map<number, Running>();
  private idleWaiters: (() => void)[] = [];
  private stopped = false;

  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly runner: Runner = sandboxedRunner,
  ) {}

  /** Builds that were running when the process died cannot be resumed. */
  start() {
    this.db
      .update(builds)
      .set({ status: "failed", error: "Interrupted by a restart of the server", finishedAt: new Date() })
      .where(eq(builds.status, "running"))
      .run();
    this.pump();
  }

  /** Stops taking builds and kills running ones (shutdown, tests). */
  async stop() {
    this.stopped = true;
    for (const r of this.running.values()) r.abort.abort();
    await this.idle();
  }

  /**
   * Queues a build of `commit`. Builds after a save (`edit`) only update the
   * preview; all others go live when they succeed. A queued (not yet running)
   * build of the same book is replaced, since only the newest one matters,
   * except that a preview build never replaces one that is to go live.
   */
  enqueue(bookId: number, commit: string, trigger: BuildRow["trigger"], userId: number | null): BuildRow {
    const publish = trigger !== "edit";
    const build = this.db.transaction((tx) => {
      tx.update(builds)
        .set({ status: "canceled", error: "Replaced by a newer build", finishedAt: new Date() })
        .where(
          and(
            eq(builds.bookId, bookId),
            eq(builds.status, "queued"),
            publish ? undefined : eq(builds.publish, false),
          ),
        )
        .run();
      return tx
        .insert(builds)
        .values({ bookId, commit, trigger, publish, status: "queued", requestedBy: userId })
        .returning()
        .get();
    });
    this.pump();
    return build;
  }

  /**
   * At startup: queues a rebuild of every published book whose build is
   * missing on disk (after restoring a backup, which leaves builds out) or,
   * with `upgrades`, was made with another Hyperbook version (after an update
   * of the platform). It rebuilds the published commit, so unpublished edits
   * stay unpublished, and runs after the teachers' own builds. Returns how
   * many were queued.
   */
  enqueueRebuilds({ upgrades }: { upgrades: boolean }): number {
    const version = hyperbookVersion(this.config);
    const published = this.db
      .select({
        bookId: books.id,
        buildId: builds.id,
        commit: builds.commit,
        builtWith: builds.hyperbookVersion,
        previewBuildId: books.previewBuildId,
      })
      .from(books)
      .innerJoin(builds, eq(builds.id, books.publishedBuildId))
      .where(and(eq(books.source, "hosted"), isNotNull(books.publishedBuildId)))
      .all();
    let queued = 0;
    for (const { bookId, buildId, commit, builtWith, previewBuildId } of published) {
      const missing = !existsSync(buildDir(this.config, bookId, buildId));
      const outdated = upgrades && version !== null && builtWith !== version;
      if (!missing && !outdated) continue;
      // A preview whose build is gone, too, shows the published book again.
      if (previewBuildId !== null && previewBuildId !== buildId && !existsSync(buildDir(this.config, bookId, previewBuildId))) {
        this.db.update(books).set({ previewBuildId: buildId }).where(eq(books.id, bookId)).run();
      }
      // A book with builds waiting or running gets a fresh build anyway.
      const busy = this.db
        .select({ id: builds.id })
        .from(builds)
        .where(and(eq(builds.bookId, bookId), inArray(builds.status, ["queued", "running"])))
        .get();
      if (busy) continue;
      this.db
        .insert(builds)
        .values({ bookId, commit, trigger: "upgrade", publish: false, replacesBuildId: buildId, status: "queued" })
        .run();
      queued++;
    }
    this.pump();
    return queued;
  }

  /** Cancels a queued or running build. Returns false if it had finished. */
  cancel(buildId: number): boolean {
    for (const r of this.running.values()) {
      if (r.buildId === buildId) {
        r.abort.abort();
        return true;
      }
    }
    const res = this.db
      .update(builds)
      .set({ status: "canceled", error: "Canceled", finishedAt: new Date() })
      .where(and(eq(builds.id, buildId), eq(builds.status, "queued")))
      .run();
    return res.changes > 0;
  }

  /** Stops everything of a book that is about to be deleted. */
  cancelBook(bookId: number) {
    this.running.get(bookId)?.abort.abort();
  }

  /** The current log of a running build, fresher than the database's copy. */
  liveLog(buildId: number): string | null {
    for (const r of this.running.values()) {
      if (r.buildId === buildId) return r.log.toString();
    }
    return null;
  }

  /** Resolves once nothing is queued or running. */
  idle(): Promise<void> {
    if (this.running.size === 0 && (this.stopped || !this.nextQueued())) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private nextQueued(): BuildRow | undefined {
    const busy = [...this.running.keys()];
    return this.db
      .select()
      .from(builds)
      .where(and(eq(builds.status, "queued"), notInArray(builds.bookId, busy)))
      // Teachers' builds before the platform's own upgrade rebuilds.
      .orderBy(sql`${builds.trigger} = 'upgrade'`, asc(builds.id))
      .limit(1)
      .get();
  }

  private pump() {
    while (!this.stopped && this.running.size < this.config.build.concurrency) {
      const next = this.nextQueued();
      if (!next) break;
      const claimed = this.db
        .update(builds)
        .set({ status: "running", startedAt: new Date(), hyperbookVersion: hyperbookVersion(this.config) })
        .where(and(eq(builds.id, next.id), eq(builds.status, "queued")))
        .run();
      if (claimed.changes === 0) continue;
      const running: Running = {
        buildId: next.id,
        bookId: next.bookId,
        abort: new AbortController(),
        log: new BuildLog(),
      };
      this.running.set(next.bookId, running);
      void this.run(next, running).finally(() => {
        this.running.delete(next.bookId);
        this.pump();
        if (this.running.size === 0 && (this.stopped || !this.nextQueued())) {
          for (const resolve of this.idleWaiters.splice(0)) resolve();
        }
      });
    }
  }

  private async run(build: BuildRow, { abort, log }: Running) {
    const saveLog = setInterval(() => {
      this.db.update(builds).set({ log: log.toString() }).where(eq(builds.id, build.id)).run();
    }, LOG_INTERVAL_MS);
    let jobDir: string | null = null;
    try {
      jobDir = await makeJobDir(this.config, `build-${build.id}`);
      const srcDir = path.join(jobDir, "src");
      await mkdir(srcDir);
      log.note(`Checking out ${build.commit.slice(0, 12)}`);
      await checkout(repoDir(this.config, build.bookId), build.commit, srcDir);
      // Canceled while checking out: the runner would never hear of it.
      if (abort.signal.aborted) {
        log.note("The build was canceled");
        this.finish(build, "canceled", log, { error: "The build was canceled" });
        return;
      }

      const outcome = await this.runner({ config: this.config, jobDir, srcDir, log, signal: abort.signal });
      if (!outcome.ok) {
        log.note(outcome.error);
        this.finish(build, abort.signal.aborted ? "canceled" : "failed", log, { error: outcome.error });
        return;
      }

      // The book may have been deleted while it was building.
      if (!this.db.select({ id: books.id }).from(books).where(eq(books.id, build.bookId)).get()) return;

      const target = buildDir(this.config, build.bookId, build.id);
      mkdirSync(path.dirname(target), { recursive: true });
      await rename(outcome.outDir, target);
      const size = `${(outcome.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
      log.note(
        build.trigger === "upgrade"
          ? `Built with Hyperbook ${hyperbookVersion(this.config)} (${size})`
          : build.publish
            ? `Published (${size})`
            : `Ready for the preview (${size})`,
      );
      this.finish(build, "succeeded", log, { sizeBytes: outcome.sizeBytes });
      await this.prune(build.bookId);
    } catch (error) {
      const message = `Internal error: ${(error as Error).message}`;
      log.note(message);
      this.finish(build, "failed", log, { error: message });
    } finally {
      clearInterval(saveLog);
      if (jobDir) await rm(jobDir, { recursive: true, force: true });
    }
  }

  private finish(
    build: BuildRow,
    status: "succeeded" | "failed" | "canceled",
    log: BuildLog,
    extra: { error?: string; sizeBytes?: number },
  ) {
    const now = new Date();
    this.db.transaction((tx) => {
      tx.update(builds)
        .set({ status, log: log.toString(), error: extra.error ?? null, sizeBytes: extra.sizeBytes ?? null, finishedAt: now })
        .where(eq(builds.id, build.id))
        .run();
      if (status === "succeeded" && build.trigger === "upgrade") {
        // Takes the place of the build it rebuilt, wherever that one still is.
        const book = tx
          .select({ published: books.publishedBuildId, preview: books.previewBuildId })
          .from(books)
          .where(eq(books.id, build.bookId))
          .get();
        if (book?.published === build.replacesBuildId) {
          tx.update(books).set({ publishedBuildId: build.id }).where(eq(books.id, build.bookId)).run();
        }
        if (book?.preview === build.replacesBuildId) {
          tx.update(books).set({ previewBuildId: build.id }).where(eq(books.id, build.bookId)).run();
        }
      } else if (status === "succeeded") {
        tx.update(books)
          .set(build.publish ? { previewBuildId: build.id, publishedBuildId: build.id, publishedAt: now } : { previewBuildId: build.id })
          .where(eq(books.id, build.bookId))
          .run();
        if (build.publish) {
          audit(tx as unknown as Db, {
            actorUserId: build.requestedBy,
            action: "book.publish",
            targetType: "book",
            targetId: build.bookId,
            data: { buildId: build.id, commit: build.commit },
          });
        }
      }
    });
  }

  /** Deletes old build output and old build records of a book. */
  private async prune(bookId: number) {
    const book = this.db
      .select({ published: books.publishedBuildId, preview: books.previewBuildId })
      .from(books)
      .where(eq(books.id, bookId))
      .get();
    const succeeded = this.db
      .select({ id: builds.id })
      .from(builds)
      .where(and(eq(builds.bookId, bookId), eq(builds.status, "succeeded")))
      .orderBy(desc(builds.id))
      .all()
      .map((b) => b.id);
    const current = [book?.published, book?.preview];
    const keep = new Set([...current, ...succeeded.filter((id) => !current.includes(id)).slice(0, KEEP_PREVIOUS)]);
    for (const id of succeeded) {
      if (!keep.has(id)) await rm(buildDir(this.config, bookId, id), { recursive: true, force: true });
    }

    const records = this.db
      .select({ id: builds.id })
      .from(builds)
      .where(eq(builds.bookId, bookId))
      .orderBy(desc(builds.id))
      .limit(1)
      .offset(KEEP_RECORDS - 1)
      .get();
    if (records) {
      const old = this.db
        .select({ id: builds.id })
        .from(builds)
        .where(and(eq(builds.bookId, bookId), lt(builds.id, records.id)))
        .all()
        .map((b) => b.id)
        .filter((id) => !keep.has(id));
      if (old.length > 0) this.db.delete(builds).where(inArray(builds.id, old)).run();
    }
  }
}

