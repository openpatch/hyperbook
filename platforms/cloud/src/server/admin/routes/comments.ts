import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  anchorsInput,
  commentsQuery,
  createThreadInput,
  editCommentInput,
  replyInput,
} from "../../../shared/schemas";
import { commentThreads, comments } from "../../db/schema";
import type { Deps } from "../../deps";
import { type Actor, visitorAccess } from "../../domain/actors";
import { queueNewThread, queueReply } from "../../domain/comment-mail";
import {
  currentText,
  isAuthor,
  mayResolve,
  placedThreads,
  publicThreads,
  quoteOf,
} from "../../domain/comments";
import { createT } from "../../i18n";
import type { AdminEnv } from "../env";
import { requireVisitor } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";
import { hostedOnly } from "./publishing";

const threadParam = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    threadId: z.coerce.number().int().positive(),
  }),
);

const commentParam = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    commentId: z.coerce.number().int().positive(),
  }),
);

/** Who wrote a thread or comment, as stored. */
const authorOf = (actor: Actor) => ({ userId: actor.userId, linkId: actor.linkId, name: actor.name });

/**
 * /api/books/:id/comments: threads on the book's source (see
 * domain/comments.ts). Everyone who may open the book comments, link
 * visitors included; only editors and owners send new positions and apply
 * suggestions.
 */
export function bookCommentRoutes({ db, config, mailer }: Deps) {
  function threadOf(bookId: number, threadId: number, locale: Parameters<typeof createT>[0]) {
    const thread = db
      .select()
      .from(commentThreads)
      .where(and(eq(commentThreads.id, threadId), eq(commentThreads.bookId, bookId)))
      .get();
    if (!thread) throw new HTTPException(404, { message: createT(locale)("comments.errors.notFound") });
    return thread;
  }

  function commentOf(bookId: number, commentId: number, locale: Parameters<typeof createT>[0]) {
    const row = db
      .select({ comment: comments, thread: commentThreads })
      .from(comments)
      .innerJoin(commentThreads, eq(commentThreads.id, comments.threadId))
      .where(and(eq(comments.id, commentId), eq(commentThreads.bookId, bookId)))
      .get();
    if (!row || row.comment.deletedAt) {
      throw new HTTPException(404, { message: createT(locale)("comments.errors.notFound") });
    }
    return row;
  }

  return new Hono<AdminEnv>()
    .use(requireVisitor)

    // Threads of one file, or of the whole book, placed in the files as
    // they are now.
    .get("/:id/comments", idParam, validate("query", commentsQuery), async (c) => {
      const { book, role, actor } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id, "commenter");
      const threads = await placedThreads(db, config, book.id, c.req.valid("query").path);
      return c.json({ threads: publicThreads(db, threads, actor, role) });
    })

    .post("/:id/comments", idParam, validate("json", createThreadInput), async (c) => {
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id, "commenter");
      hostedOnly(book);
      const t = createT(c.get("locale"));
      const { anchor, body, suggestion } = c.req.valid("json");
      const file = await currentText(config, book.id, anchor.path);
      if (!file) throw new HTTPException(404, { message: t("comments.errors.noFile") });
      // The range is in the text the editor loaded; a newer save moved it.
      if (file.oid !== anchor.oid) throw new HTTPException(409, { message: t("comments.errors.changed") });
      if (anchor.to > file.text.length) throw new HTTPException(400, { message: t("comments.errors.range") });
      const by = authorOf(actor);
      const created = db.transaction((tx) => {
        const thread = tx
          .insert(commentThreads)
          .values({
            bookId: book.id,
            path: anchor.path,
            anchorFrom: anchor.from,
            anchorTo: anchor.to,
            anchorOid: anchor.oid,
            ...quoteOf(file.text, anchor.from, anchor.to),
            createdByUserId: by.userId,
            createdByLinkId: by.linkId,
            createdByName: by.name,
          })
          .returning()
          .get();
        const comment = tx
          .insert(comments)
          .values({
            threadId: thread.id,
            authorUserId: by.userId,
            authorLinkId: by.linkId,
            authorName: by.name,
            body,
            suggestion,
          })
          .returning()
          .get();
        return { thread, comment };
      });
      queueNewThread(db, mailer, book.id, created.comment.id, by.userId);
      return c.json({ threadId: created.thread.id });
    })

    .post("/:id/comments/:threadId/replies", threadParam, validate("json", replyInput), (c) => {
      const { id, threadId } = c.req.valid("param");
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "commenter");
      const thread = threadOf(book.id, threadId, c.get("locale"));
      const { body, suggestion } = c.req.valid("json");
      const by = authorOf(actor);
      const comment = db
        .insert(comments)
        .values({
          threadId: thread.id,
          authorUserId: by.userId,
          authorLinkId: by.linkId,
          authorName: by.name,
          body,
          suggestion,
        })
        .returning()
        .get();
      queueReply(db, mailer, book.id, thread.id, comment.id, by.userId);
      return c.json({ commentId: comment.id });
    })

    .patch("/:id/comments/c/:commentId", commentParam, validate("json", editCommentInput), (c) => {
      const { id, commentId } = c.req.valid("param");
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "commenter");
      const { comment } = commentOf(book.id, commentId, c.get("locale"));
      if (!isAuthor(actor, { userId: comment.authorUserId, linkId: comment.authorLinkId })) {
        throw new HTTPException(403, { message: createT(c.get("locale"))("comments.errors.notYours") });
      }
      db.update(comments)
        .set({ body: c.req.valid("json").body, editedAt: new Date() })
        .where(eq(comments.id, comment.id))
        .run();
      return c.json({ ok: true as const });
    })

    // Kept as "deleted" in its place, so the replies after it still make sense.
    .delete("/:id/comments/c/:commentId", commentParam, (c) => {
      const { id, commentId } = c.req.valid("param");
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "commenter");
      const { comment } = commentOf(book.id, commentId, c.get("locale"));
      if (!isAuthor(actor, { userId: comment.authorUserId, linkId: comment.authorLinkId })) {
        throw new HTTPException(403, { message: createT(c.get("locale"))("comments.errors.notYours") });
      }
      db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id)).run();
      return c.json({ ok: true as const });
    })

    .post("/:id/comments/:threadId/resolve", threadParam, (c) => {
      const { id, threadId } = c.req.valid("param");
      const { book, role, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "commenter");
      const thread = threadOf(book.id, threadId, c.get("locale"));
      if (!mayResolve(actor, role, thread)) {
        throw new HTTPException(403, { message: createT(c.get("locale"))("comments.errors.mayNotResolve") });
      }
      db.update(commentThreads)
        .set({ status: "resolved", resolvedByName: actor.name, resolvedAt: new Date() })
        .where(eq(commentThreads.id, thread.id))
        .run();
      return c.json({ ok: true as const });
    })

    .post("/:id/comments/:threadId/reopen", threadParam, (c) => {
      const { id, threadId } = c.req.valid("param");
      const { book, role, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "commenter");
      const thread = threadOf(book.id, threadId, c.get("locale"));
      if (!mayResolve(actor, role, thread)) {
        throw new HTTPException(403, { message: createT(c.get("locale"))("comments.errors.mayNotResolve") });
      }
      db.update(commentThreads)
        .set({ status: "open", resolvedByName: null, resolvedAt: null })
        .where(eq(commentThreads.id, thread.id))
        .run();
      return c.json({ ok: true as const });
    })

    // An editor applied the suggestion in the open file: it is marked, and
    // the thread is resolved. The text itself changes with their next save.
    .post("/:id/comments/c/:commentId/applied", commentParam, (c) => {
      const { id, commentId } = c.req.valid("param");
      const { book, actor } = visitorAccess(db, c.get("user"), c.get("link"), id, "editor");
      const { comment, thread } = commentOf(book.id, commentId, c.get("locale"));
      if (comment.suggestion === null) {
        throw new HTTPException(400, { message: createT(c.get("locale"))("comments.errors.noSuggestion") });
      }
      const now = new Date();
      db.transaction((tx) => {
        tx.update(comments).set({ appliedAt: now }).where(eq(comments.id, comment.id)).run();
        tx.update(commentThreads)
          .set({ status: "resolved", resolvedByName: actor.name, resolvedAt: now })
          .where(eq(commentThreads.id, thread.id))
          .run();
      });
      return c.json({ ok: true as const });
    })

    // After a save: where the editor's marks of `path` are in the saved
    // blob `oid`. This keeps threads whose own text was edited; a null
    // range means its text was deleted.
    .post("/:id/comments/anchors", idParam, validate("json", anchorsInput), async (c) => {
      const { book } = visitorAccess(db, c.get("user"), c.get("link"), c.req.valid("param").id, "editor");
      const t = createT(c.get("locale"));
      const { path, oid, anchors } = c.req.valid("json");
      const file = await currentText(config, book.id, path);
      if (!file) throw new HTTPException(404, { message: t("comments.errors.noFile") });
      if (file.oid !== oid) throw new HTTPException(409, { message: t("comments.errors.changed") });
      const now = new Date();
      db.transaction((tx) => {
        for (const a of anchors) {
          const where = and(
            eq(commentThreads.id, a.threadId),
            eq(commentThreads.bookId, book.id),
            eq(commentThreads.path, path),
          );
          if (a.from === null || a.to === null || a.to <= a.from || a.to > file.text.length) {
            tx.update(commentThreads).set({ detachedAt: now }).where(where).run();
            continue;
          }
          tx.update(commentThreads)
            .set({
              anchorFrom: a.from,
              anchorTo: a.to,
              anchorOid: oid,
              detachedAt: null,
              ...quoteOf(file.text, a.from, a.to),
            })
            .where(where)
            .run();
        }
      });
      return c.json({ ok: true as const });
    });
}
