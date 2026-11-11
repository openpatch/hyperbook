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
import { publishInput, publishingLockInput, publishRequestInput, rollbackInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import type { SessionUser } from "../../auth/sessions";
import { bookLinks, bookMembers, books, builds, users } from "../../db/schema";
import type { Deps } from "../../deps";
import { type BookRow, addCommits, bookAccess, publicBook } from "../../domain/books";
import { type Actor, visitorAccess } from "../../domain/actors";
import { getInstanceSettings } from "../../domain/instance";
import { createT, userLocale } from "../../i18n";
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
  logCommits,
  resolveTagCommit,
  revListCount,
} from "../../hosting/git";
import { markPublished, movePublishedTag, tagMap } from "../../hosting/publish-tags";
import { buildDir, makeJobDir, repoDir } from "../../hosting/storage";
import { quotaForBook, quotaMessage, setSourceBytes } from "../../domain/storage";
import { zipDirectory } from "../../hosting/site-zip";
import { ZipError, extractBook } from "../../hosting/zip";
import type { AdminEnv, AuthedEnv } from "../env";
import { requireUser, requireVisitor } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

const MAX_ENTRIES = 20_000;

const buildParam = validate(
  "param",
  z.object({ id: z.coerce.number().int().positive(), buildId: z.coerce.number().int().positive() }),
);

function publicBuild(
  build: BuildRow,
  book: Pick<BookRow, "publishedBuildId">,
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

/**
 * Refuses while the book's publishing lock is set. Reads the row anew: the
 * routes below await between their first check and the moment a build goes
 * live, and the lock may have been set in between.
 */
export function assertPublishingAllowed(db: Deps["db"], bookId: number) {
  const row = db
    .select({ disabled: books.publishingDisabled })
    .from(books)
    .where(eq(books.id, bookId))
    .get();
  if (row?.disabled) {
    throw new HTTPException(403, { message: "publishing.lock.refused" });
  }
}

/** Saves of main listed with the head, newest first; the count says how many there are. */
const MAX_CHANGES = 30;

/** /api/books/:id/source, /head, /builds, /publish, /check, /unpublish */
export function bookPublishingRoutes({ db, config, mailer, builds: queue, checks }: Deps) {
  const committer = {
    name: "Hyperbook Cloud",
    email: `noreply@${config.adminHost.replace(/:\d+$/, "")}`,
  };

  function author(user: SessionUser) {
    return { name: user.displayName || user.email.split("@")[0]!, email: user.email };
  }

  function publishRequest(book: BookRow) {
    if (!book.publishRequestedAt) return null;
    const by = book.publishRequestedBy
      ? db
          .select({ id: users.id, email: users.email, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, book.publishRequestedBy))
          .get()
      : undefined;
    const link = book.publishRequestedByLink
      ? db.select({ name: bookLinks.name }).from(bookLinks).where(eq(bookLinks.id, book.publishRequestedByLink)).get()
      : undefined;
    return {
      byId: by?.id ?? null,
      /** The access link whose visitor asked (see domain/links.ts). */
      byLinkId: book.publishRequestedByLink,
      by: by ? by.displayName || by.email : (link?.name ?? null),
      at: book.publishRequestedAt.getTime(),
      note: book.publishRequestNote,
    };
  }

  function clearPublishRequest(bookId: number) {
    db.update(books)
      .set({ publishRequestedBy: null, publishRequestedByLink: null, publishRequestedAt: null, publishRequestNote: null })
      .where(eq(books.id, bookId))
      .run();
  }

  /** Each owner but the one asking gets the request, in their own language. */
  async function mailOwners(book: BookRow, by: Actor, note: string | null) {
    if (!mailer.enabled) return;
    const owners = db
      .select({ id: users.id, email: users.email, locale: users.locale })
      .from(bookMembers)
      .innerJoin(users, eq(users.id, bookMembers.userId))
      .where(and(eq(bookMembers.bookId, book.id), eq(bookMembers.role, "owner")))
      .all()
      .filter((o) => o.id !== by.userId);
    const name = getInstanceSettings(db).name;
    for (const owner of owners) {
      const t = createT(userLocale(db, owner.locale));
      const subject = t("mail.publishRequest.subject", { title: book.title });
      try {
        await mailer.send({
          to: owner.email,
          subject,
          text: t("mail.publishRequest.body", {
            by: by.kind === "user" ? by.user.displayName || by.user.email : by.name,
            title: book.title,
            name,
            note: note ? t("mail.publishRequest.note", { note }) : "",
            bookUrl: `${config.adminOrigin}/books/${book.id}`,
          }),
        });
      } catch (error) {
        console.error(`Sending "${subject}" failed:`, error);
      }
    }
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

  // What link editors use too (see domain/actors.ts): the head, and asking
  // the owners to publish. Mounted before the account-only routers.
  const visitor = new Hono<AdminEnv>()
    .use(requireVisitor)

    // The newest save of main, which the preview shows and a publish makes
    // live; the saves it has that the live site does not (newest first, at
    // most MAX_CHANGES, `unpublished` counts them all); and an editor's
    // open request to publish.
    .get("/:id/head", idParam, async (c) => {
      const { book } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id);
      const repo = repoDir(config, book.id);
      const request = publishRequest(book);
      const commit = await headCommit(repo).catch(() => null);
      if (!commit) return c.json({ commit: null, savedAt: null, unpublished: 0, changes: [], request });
      const live = book.publishedBuildId !== null
        ? (await listTags(repo).catch(() => [])).find((t) => t.name === "published")?.commit ?? null
        : null;
      const [changes, [last]] = await Promise.all([
        logCommits(repo, { limit: MAX_CHANGES, after: null, exclude: live }),
        logCommits(repo, { limit: 1, after: null }),
      ]);
      return c.json({
        commit,
        savedAt: last ? Date.parse(last.date) : null,
        unpublished: changes.length < MAX_CHANGES ? changes.length : await revListCount(repo, live, commit),
        changes,
        request,
      });
    })

    // An editor asks the owners to publish the latest save; they get an
    // email (when the instance sends any) and see it on the book page.
    .post("/:id/publish-request", idParam, validate("json", publishRequestInput), async (c) => {
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id);
      hostedOnly(book);
      assertPublishingAllowed(db, book.id);
      const note = c.req.valid("json").note || null;
      const now = new Date();
      const by = { publishRequestedBy: actor.userId, publishRequestedByLink: actor.linkId };
      db.update(books)
        .set({ ...by, publishRequestedAt: now, publishRequestNote: note })
        .where(eq(books.id, book.id))
        .run();
      audit(db, {
        actorUserId: actor.userId,
        action: "book.publishRequest",
        targetType: "book",
        targetId: book.id,
        data: actor.kind === "link" ? { note, linkId: actor.linkId, name: actor.name } : { note },
      });
      await mailOwners(book, actor, note);
      return c.json(publishRequest({ ...book, ...by, publishRequestedAt: now, publishRequestNote: note }));
    })

    // Dismissed by an owner, or taken back by whoever asked.
    .delete("/:id/publish-request", idParam, (c) => {
      const { book, role, actor } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id);
      const mine =
        actor.kind === "user" ? book.publishRequestedBy === actor.userId : book.publishRequestedByLink === actor.linkId;
      if (role !== "owner" && !mine) {
        throw new HTTPException(403, { message: "Only the owners or whoever asked can dismiss this" });
      }
      clearPublishRequest(book.id);
      return c.json({ ok: true as const });
    });

  const account = new Hono<AuthedEnv>()
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
          // No build: the preview shows the upload at once, and publishing
          // builds it. A check of all pages says early whether it renders.
          if (changed) checks.start(book.id);
          audit(db, {
            actorUserId: user.id,
            action: "book.upload",
            targetType: "book",
            targetId: book.id,
            data: { commit, changed, files: unpacked.files, bytes: unpacked.bytes, skipped: unpacked.skipped },
          });
          return c.json({
            commit,
            changed,
            files: unpacked.files,
            skipped: unpacked.skipped,
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

    // "Check all pages": renders every page of the latest save in the
    // background; the book page polls the state.
    .get("/:id/check", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json(checks.get(book.id));
    })
    .post("/:id/check", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      hostedOnly(book);
      if (!(await headCommit(repoDir(config, book.id)).catch(() => null))) {
        throw new HTTPException(409, { message: "The book has no files yet" });
      }
      return c.json(checks.start(book.id));
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

    // Makes the current commit live: its newest successful build if there is
    // one (a build does not depend on the host serving it), otherwise the one
    // waiting or running for it, or else a new build, which go live when they
    // succeed. A publish is recorded as a v<N> tag plus the moving "published"
    // tag; an optional note is stored on the build.
    .post("/:id/publish", idParam, validate("json", publishInput), async (c) => {
      const user = c.get("user");
      // What goes live is the owners' call; editors work on the preview.
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      hostedOnly(book);
      assertPublishingAllowed(db, book.id);
      const note = c.req.valid("json").note || null;
      const commit = await headCommit(repoDir(config, book.id)).catch(() => null);
      if (!commit) throw new HTTPException(409, { message: "The book has no files yet" });
      // An owner acted on the latest save: an editor's request is answered.
      clearPublishRequest(book.id);
      const built = db
        .select()
        .from(builds)
        .where(and(eq(builds.bookId, book.id), eq(builds.commit, commit), eq(builds.status, "succeeded")))
        .orderBy(desc(builds.id))
        .limit(1)
        .get();
      if (built && existsSync(buildDir(config, book.id, built.id))) {
        const now = new Date();
        // Again, with nothing awaited before the update: see the function.
        assertPublishingAllowed(db, book.id);
        db.update(books).set({ publishedBuildId: built.id, publishedAt: now }).where(eq(books.id, book.id)).run();
        queue.supersedePublishing(book.id);
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
      assertPublishingAllowed(db, book.id);
      const build = queue.publishPending(book.id, commit, user.id, note) ?? queue.enqueue(book.id, commit, "publish", user.id, note ?? undefined);
      return c.json({ published: false, build: publicBuild(build, book, user.email, queue.progress(build.id)) });
    })

    // Rolls the live site back to a version tag: instantly when that commit's
    // build is still kept, otherwise by rebuilding the tag's commit, which
    // goes live on success. main is never rewritten.
    .post("/:id/rollback", idParam, validate("json", rollbackInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      hostedOnly(book);
      assertPublishingAllowed(db, book.id);
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
        assertPublishingAllowed(db, book.id);
        db.update(books).set({ publishedBuildId: kept.id, publishedAt: now }).where(eq(books.id, book.id)).run();
        queue.supersedePublishing(book.id);
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
      assertPublishingAllowed(db, book.id);
      const build = queue.enqueue(book.id, commit, "rollback", user.id);
      return c.json({ published: false, build: publicBuild(build, book, user.email, queue.progress(build.id)) });
    })

    // The publishing lock, for books that must never be public (exams).
    // Turning it on takes the book offline, drops an open request to publish
    // and keeps builds that are waiting or running from going live — in one
    // transaction, so nothing slips through between the steps.
    .post("/:id/publishing-lock", idParam, validate("json", publishingLockInput), (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      hostedOnly(book);
      const { disabled } = c.req.valid("json");
      db.transaction((tx) => {
        tx.update(books)
          .set({
            publishingDisabled: disabled,
            ...(disabled && {
              publishedBuildId: null,
              publishedAt: null,
              publishRequestedBy: null,
              publishRequestedAt: null,
              publishRequestNote: null,
            }),
            updatedAt: new Date(),
          })
          .where(eq(books.id, book.id))
          .run();
        if (disabled) queue.supersedePublishing(book.id, tx as unknown as Deps["db"]);
        audit(tx as unknown as Deps["db"], {
          actorUserId: user.id,
          action: disabled ? "book.publishingLock" : "book.publishingUnlock",
          targetType: "book",
          targetId: book.id,
          data: disabled ? { unpublishedBuildId: book.publishedBuildId } : {},
        });
      });
      const updated = db.select().from(books).where(eq(books.id, book.id)).get()!;
      return c.json(publicBook(config, updated, "owner"));
    })

    .post("/:id/unpublish", idParam, (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      db.update(books)
        .set({ publishedBuildId: null, publishedAt: null })
        .where(eq(books.id, book.id))
        .run();
      queue.supersedePublishing(book.id);
      audit(db, {
        actorUserId: user.id,
        action: "book.unpublish",
        targetType: "book",
        targetId: book.id,
        data: { buildId: book.publishedBuildId },
      });
      return c.json({ ok: true as const });
    });

  return { visitor, account };
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
