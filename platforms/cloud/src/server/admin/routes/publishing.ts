import { createWriteStream, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { publishInput, rollbackInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import type { SessionUser } from "../../auth/sessions";
import { books, builds, users } from "../../db/schema";
import type { Deps } from "../../deps";
import { type BookRow, addCommits, bookAccess } from "../../domain/books";
import type { BuildProgress, BuildRow } from "../../hosting/builds";
import {
  ConcurrentChangeError,
  archiveZip,
  commitTree,
  headCommit,
  initRepo,
  listTree,
  listVersionTags,
  listTags,
  resolveTagCommit,
} from "../../hosting/git";
import { markPublished, movePublishedTag, tagMap } from "../../hosting/publish-tags";
import { buildDir, makeJobDir, repoDir } from "../../hosting/storage";
import { quotaForBook, quotaMessage, setSourceBytes } from "../../domain/storage";
import { zipDirectory } from "../../hosting/site-zip";
import { ZipError, extractBook } from "../../hosting/zip";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

const MAX_ENTRIES = 20_000;

const buildParam = validate(
  "param",
  z.object({ id: z.coerce.number().int().positive(), buildId: z.coerce.number().int().positive() }),
);

function publicBuild(
  build: BuildRow,
  book: Pick<BookRow, "publishedBuildId" | "previewBuildId">,
  requestedBy: string | null,
  progress: BuildProgress | null = null,
  tags: string[] = [],
) {
  return {
    id: build.id,
    commit: build.commit,
    status: build.status,
    trigger: build.trigger,
    requestedBy,
    note: build.note,
    commitCount: build.commitCount,
    tags,
    hyperbookVersion: build.hyperbookVersion,
    error: build.error,
    sizeBytes: build.sizeBytes,
    publish: build.publish,
    published: book.publishedBuildId === build.id,
    preview: book.previewBuildId === build.id,
    createdAt: build.createdAt.getTime(),
    startedAt: build.startedAt?.getTime() ?? null,
    finishedAt: build.finishedAt?.getTime() ?? null,
    progress,
  };
}

export function hostedOnly(book: BookRow) {
  if (book.source === "external") {
    throw new HTTPException(409, {
      message: "This book is hosted elsewhere. Remove its external address to host it here.",
    });
  }
}

/** /api/books/:id/source, /builds, /unpublish */
export function bookPublishingRoutes({ db, config, builds: queue }: Deps) {
  const committer = {
    name: "Hyperbook Cloud",
    email: `noreply@${config.adminHost.replace(/:\d+$/, "")}`,
  };

  function author(user: SessionUser) {
    return { name: user.displayName || user.email.split("@")[0]!, email: user.email };
  }

  async function buildsOf(book: BookRow) {
    const tags = await tagMap(config, book.id);
    // A version tag belongs to a commit; only its newest build shows it.
    const tagged = new Set<string>();
    return db
      .select({ build: builds, requestedBy: users.email })
      .from(builds)
      .leftJoin(users, eq(users.id, builds.requestedBy))
      .where(eq(builds.bookId, book.id))
      .orderBy(desc(builds.id))
      .limit(20)
      .all()
      .map(({ build, requestedBy }) => {
        const first = !tagged.has(build.commit);
        tagged.add(build.commit);
        const versionTags = first ? (tags.get(build.commit) ?? []).filter((t) => /^v\d+$/.test(t)) : [];
        return publicBuild(build, book, requestedBy, queue.progress(build.id), versionTags);
      });
  }

  return new Hono<AuthedEnv>()
    .use(requireUser)

    .post(
      "/:id/source",
      idParam,
      bodyLimit({
        // Room for the multipart envelope around the zip.
        maxSize: config.uploadMaxBytes + 64 * 1024,
        onError: () => {
          throw new HTTPException(413, {
            message: `The zip is larger than ${config.uploadMaxBytes / 1024 / 1024} MB`,
          });
        },
      }),
      async (c) => {
        const user = c.get("user");
        const { book } = bookAccess(db, user, c.req.valid("param").id);
        hostedOnly(book);
        const body = await c.req.parseBody();
        const file = body.file;
        if (!(file instanceof File)) {
          throw new HTTPException(400, { message: "Choose a zip file to upload" });
        }

        const jobDir = await makeJobDir(config, `upload-${book.id}`);
        try {
          const zipFile = path.join(jobDir, "upload.zip");
          await pipeline(Readable.fromWeb(file.stream() as never), createWriteStream(zipFile));
          const srcDir = path.join(jobDir, "src");
          let unpacked;
          try {
            unpacked = await extractBook(zipFile, srcDir, {
              maxBytes: config.bookMaxBytes,
              maxEntries: MAX_ENTRIES,
            });
          } catch (error) {
            if (error instanceof ZipError) throw new HTTPException(400, { message: error.message });
            throw error;
          }

          const quota = quotaForBook(db, book.id);
          if (quota && unpacked.bytes > quota.maxBytes) {
            throw new HTTPException(413, { message: quotaMessage(quota.owner, user.email) });
          }
          const repo = repoDir(config, book.id);
          await initRepo(repo);
          const { commit, changed } = await commitTree(repo, srcDir, {
            message: `Upload ${file.name || "zip"}`,
            author: author(user),
            committer,
          }).catch((error) => {
            if (error instanceof ConcurrentChangeError) {
              throw new HTTPException(409, { message: error.message });
            }
            throw error;
          });
          setSourceBytes(db, book.id, (await listTree(repo, commit)).reduce((sum, e) => sum + e.size, 0));
          if (changed) addCommits(db, book.id, 1);
          // The whole list goes into the build's log; the toast can only show a few.
          const skippedNote =
            unpacked.skipped.length > 0
              ? `The upload left out ${unpacked.skipped.length} link(s), which are not carried over:\n${unpacked.skipped.map((entry) => `  ${entry}`).join("\n")}`
              : undefined;
          const build = queue.enqueue(book.id, commit, "upload", user.id, skippedNote);
          audit(db, {
            actorUserId: user.id,
            action: "book.upload",
            targetType: "book",
            targetId: book.id,
            data: { commit, changed, files: unpacked.files, bytes: unpacked.bytes, buildId: build.id },
          });
          return c.json({
            commit,
            changed,
            files: unpacked.files,
            skipped: unpacked.skipped,
            build: publicBuild(build, book, user.email),
          });
        } finally {
          await rm(jobDir, { recursive: true, force: true });
        }
      },
    )

    .get("/:id/source.zip", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const repo = repoDir(config, book.id);
      const commit = await headCommit(repo).catch(() => null);
      if (!commit) throw new HTTPException(404, { message: "Nothing has been uploaded yet" });
      c.header("content-type", "application/zip");
      c.header("content-disposition", `attachment; filename="${book.slug}.zip"`);
      return c.body(Readable.toWeb(archiveZip(repo, commit)) as ReadableStream);
    })

    // The published versions (v<N> tags): all of them stay, their builds only
    // while kept. The live one is the newest tag on the commit "published" is at.
    .get("/:id/versions", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const repo = repoDir(config, book.id);
      const [versions, tags] = await Promise.all([
        listVersionTags(repo).catch(() => []),
        listTags(repo).catch(() => []),
      ]);
      const liveCommit = tags.find((t) => t.name === "published")?.commit;
      const rows = db
        .select({ id: builds.id, commit: builds.commit, note: builds.note, hyperbookVersion: builds.hyperbookVersion })
        .from(builds)
        .where(and(eq(builds.bookId, book.id), eq(builds.status, "succeeded")))
        .orderBy(desc(builds.id))
        .all();
      const liveTag = versions.find((v) => v.commit === liveCommit)?.name;
      return c.json(
        versions.map((v) => {
          const own = rows.filter((r) => r.commit === v.commit);
          const kept = own.find((r) => existsSync(buildDir(config, book.id, r.id)));
          return {
            tag: v.name,
            commit: v.commit,
            committedAt: v.committedAt,
            note: own.find((r) => r.note)?.note ?? null,
            live: v.name === liveTag,
            buildId: kept?.id ?? null,
            hyperbookVersion: (kept ?? own[0])?.hyperbookVersion ?? null,
          };
        }),
      );
    })

    .get("/:id/builds", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json(await buildsOf(book));
    })

    // The built website, for hosting it elsewhere.
    .get("/:id/builds/:buildId/site.zip", buildParam, (c) => {
      const { id, buildId } = c.req.valid("param");
      const { book } = bookAccess(db, c.get("user"), id);
      const build = db
        .select()
        .from(builds)
        .where(and(eq(builds.id, buildId), eq(builds.bookId, book.id), eq(builds.status, "succeeded")))
        .get();
      const dir = build && buildDir(config, book.id, build.id);
      if (!dir || !existsSync(dir)) throw new HTTPException(404, { message: "This build is not kept anymore" });
      c.header("content-type", "application/zip");
      c.header("content-disposition", `attachment; filename="${book.slug}.zip"`);
      return c.body(Readable.toWeb(zipDirectory(dir)) as ReadableStream);
    })

    .post("/:id/builds", idParam, async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const commit = await headCommit(repoDir(config, book.id)).catch(() => null);
      if (!commit) throw new HTTPException(409, { message: "Upload the book first" });
      const build = queue.enqueue(book.id, commit, "rebuild", user.id);
      audit(db, {
        actorUserId: user.id,
        action: "book.rebuild",
        targetType: "book",
        targetId: book.id,
        data: { commit, buildId: build.id },
      });
      return c.json(publicBuild(build, book, user.email));
    })

    // Makes the current commit live: its newest successful build if there is
    // one (a build does not depend on the host serving it), otherwise the one
    // waiting or running for it, or else a new build, which go live when they
    // succeed. A publish is recorded as a v<N> tag plus the moving "published"
    // tag; an optional note is stored on the build.
    .post("/:id/publish", idParam, validate("json", publishInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const note = c.req.valid("json").note || null;
      const commit = await headCommit(repoDir(config, book.id)).catch(() => null);
      if (!commit) throw new HTTPException(409, { message: "The book has no files yet" });
      const built = db
        .select()
        .from(builds)
        .where(and(eq(builds.bookId, book.id), eq(builds.commit, commit), eq(builds.status, "succeeded")))
        .orderBy(desc(builds.id))
        .limit(1)
        .get();
      if (built && existsSync(buildDir(config, book.id, built.id))) {
        const now = new Date();
        db.update(books).set({ publishedBuildId: built.id, publishedAt: now }).where(eq(books.id, book.id)).run();
        if (note) db.update(builds).set({ note }).where(eq(builds.id, built.id)).run();
        await markPublished(db, config, book.id, commit);
        audit(db, {
          actorUserId: user.id,
          action: "book.publish",
          targetType: "book",
          targetId: book.id,
          data: { buildId: built.id, commit, note },
        });
        const tags = await tagMap(config, book.id);
        return c.json({
          published: true,
          build: publicBuild({ ...built, note: note ?? built.note }, { ...book, publishedBuildId: built.id }, null, null, tags.get(commit) ?? []),
        });
      }
      const build = queue.publishPending(book.id, commit, user.id, note) ?? queue.enqueue(book.id, commit, "publish", user.id, note ?? undefined);
      return c.json({ published: false, build: publicBuild(build, book, user.email, queue.progress(build.id)) });
    })

    // Rolls the live site back to a version tag: instantly when that commit's
    // build is still kept, otherwise by rebuilding the tag's commit, which
    // goes live on success. main is never rewritten.
    .post("/:id/rollback", idParam, validate("json", rollbackInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const { tag } = c.req.valid("json");
      const repo = repoDir(config, book.id);
      const commit = await resolveTagCommit(repo, tag);
      if (!commit) throw new HTTPException(404, { message: `This book has no version ${tag}` });
      const kept = db
        .select()
        .from(builds)
        .where(and(eq(builds.bookId, book.id), eq(builds.commit, commit), eq(builds.status, "succeeded")))
        .orderBy(desc(builds.id))
        .limit(1)
        .get();
      if (kept && existsSync(buildDir(config, book.id, kept.id))) {
        const now = new Date();
        db.update(books).set({ publishedBuildId: kept.id, publishedAt: now }).where(eq(books.id, book.id)).run();
        await movePublishedTag(config, book.id, commit);
        audit(db, {
          actorUserId: user.id,
          action: "book.rollback",
          targetType: "book",
          targetId: book.id,
          data: { buildId: kept.id, commit, tag },
        });
        const tags = await tagMap(config, book.id);
        return c.json({
          published: true,
          build: publicBuild(kept, { ...book, publishedBuildId: kept.id }, null, null, tags.get(commit) ?? []),
        });
      }
      // The rebuild audits when it goes live (finish), like a publish build.
      const build = queue.enqueue(book.id, commit, "rollback", user.id);
      return c.json({ published: false, build: publicBuild(build, book, user.email, queue.progress(build.id)) });
    })

    .post("/:id/unpublish", idParam, (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      db.update(books)
        .set({ publishedBuildId: null, publishedAt: null })
        .where(eq(books.id, book.id))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.unpublish",
        targetType: "book",
        targetId: book.id,
        data: { buildId: book.publishedBuildId },
      });
      return c.json({ ok: true as const });
    });
}

/** /api/builds/:id */
export function buildRoutes({ db, config, builds: queue }: Deps) {
  function buildAccess(user: SessionUser, buildId: number) {
    const build = db.select().from(builds).where(eq(builds.id, buildId)).get();
    if (!build) throw new HTTPException(404, { message: "Build not found" });
    const { book } = bookAccess(db, user, build.bookId);
    return { build, book };
  }

  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id", idParam, async (c) => {
      const { build, book } = buildAccess(c.get("user"), c.req.valid("param").id);
      const requestedBy = build.requestedBy
        ? (db.select({ email: users.email }).from(users).where(eq(users.id, build.requestedBy)).get()?.email ?? null)
        : null;
      const tags = await tagMap(config, book.id);
      return c.json({
        ...publicBuild(build, book, requestedBy, null, tags.get(build.commit) ?? []),
        log: queue.liveLog(build.id) ?? build.log,
      });
    })

    .post("/:id/cancel", idParam, (c) => {
      const user = c.get("user");
      const { build, book } = buildAccess(user, c.req.valid("param").id);
      if (!queue.cancel(build.id)) {
        throw new HTTPException(409, { message: "This build has finished already" });
      }
      audit(db, {
        actorUserId: user.id,
        action: "book.build.cancel",
        targetType: "book",
        targetId: book.id,
        data: { buildId: build.id },
      });
      return c.json({ ok: true as const });
    });
}
