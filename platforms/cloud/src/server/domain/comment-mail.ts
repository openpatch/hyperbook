import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { bookMembers, books, commentMailQueue, commentThreads, comments, users } from "../db/schema";
import { createT, userLocale } from "../i18n";
import type { Mailer } from "../mail";
import { getInstanceSettings } from "./instance";

/*
 * Emails about comments, as a digest: what happens in a book is queued per
 * account, and an account gets at most one email per book every
 * DIGEST_INTERVAL_MS. Owners and editors hear of new threads; whoever took
 * part in a thread hears of its replies. Link visitors have no address, and
 * members can switch the emails off per book (book_members.comment_mail).
 */

export const DIGEST_INTERVAL_MS = 15 * 60 * 1000;
/** How much of a comment the email quotes. */
const EXCERPT = 300;

function queue(db: Db, bookId: number, commentId: number, userIds: Iterable<number>) {
  const rows = [...new Set(userIds)].map((userId) => ({ userId, bookId, commentId }));
  if (rows.length) db.insert(commentMailQueue).values(rows).run();
}

/** Members of the book who want comment emails, of the given roles. */
function subscribers(db: Db, bookId: number, roles: ("owner" | "editor" | "commenter")[]) {
  return db
    .select({ userId: bookMembers.userId })
    .from(bookMembers)
    .where(
      and(eq(bookMembers.bookId, bookId), eq(bookMembers.commentMail, true), inArray(bookMembers.role, roles)),
    )
    .all()
    .map((r) => r.userId);
}

/** A new thread: its book's owners and editors hear of it. */
export function queueNewThread(db: Db, mailer: Mailer, bookId: number, commentId: number, byUserId: number | null) {
  if (!mailer.enabled) return;
  queue(
    db,
    bookId,
    commentId,
    subscribers(db, bookId, ["owner", "editor"]).filter((id) => id !== byUserId),
  );
}

/** A reply: everyone (with an account) who wrote in the thread hears of it. */
export function queueReply(
  db: Db,
  mailer: Mailer,
  bookId: number,
  threadId: number,
  commentId: number,
  byUserId: number | null,
) {
  if (!mailer.enabled) return;
  const thread = db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).get();
  if (!thread) return;
  const wrote = new Set(
    db
      .select({ userId: comments.authorUserId })
      .from(comments)
      .where(and(eq(comments.threadId, threadId), ne(comments.id, commentId)))
      .all()
      .map((r) => r.userId)
      .concat(thread.createdByUserId),
  );
  queue(
    db,
    bookId,
    commentId,
    subscribers(db, bookId, ["owner", "editor", "commenter"]).filter((id) => id !== byUserId && wrote.has(id)),
  );
}

/**
 * Sends the digests that are due: one email per account and book whose last
 * one is DIGEST_INTERVAL_MS old (or that never got one). Runs every minute.
 */
export async function sendCommentDigests(db: Db, config: Config, mailer: Mailer, now = Date.now()) {
  const pending = db
    .select({
      id: commentMailQueue.id,
      userId: commentMailQueue.userId,
      bookId: commentMailQueue.bookId,
      commentId: commentMailQueue.commentId,
    })
    .from(commentMailQueue)
    .orderBy(asc(commentMailQueue.id))
    .all();
  const groups = new Map<string, typeof pending>();
  for (const row of pending) {
    const key = `${row.userId}:${row.bookId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const rows of groups.values()) {
    const { userId, bookId } = rows[0]!;
    const drop = () =>
      db.delete(commentMailQueue).where(inArray(commentMailQueue.id, rows.map((r) => r.id))).run();
    const member = db
      .select()
      .from(bookMembers)
      .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, userId)))
      .get();
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    const book = db.select().from(books).where(eq(books.id, bookId)).get();
    // Left the book, switched the emails off, or disabled since: nothing to send.
    if (!member || !member.commentMail || !user || user.disabledAt || !book || !mailer.enabled) {
      drop();
      continue;
    }
    if (member.commentMailSentAt && now - member.commentMailSentAt.getTime() < DIGEST_INTERVAL_MS) continue;

    const items = db
      .select({ comment: comments, thread: commentThreads })
      .from(comments)
      .innerJoin(commentThreads, eq(commentThreads.id, comments.threadId))
      .where(inArray(comments.id, rows.map((r) => r.commentId)))
      .orderBy(asc(comments.id))
      .all()
      .filter(({ comment }) => !comment.deletedAt);
    if (items.length === 0) {
      drop();
      continue;
    }
    const t = createT(userLocale(db, user.locale));
    const lines = items.map(({ comment, thread }) => {
      const excerpt =
        comment.body.length > EXCERPT ? `${comment.body.slice(0, EXCERPT).trimEnd()}…` : comment.body;
      const first = db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.threadId, thread.id))
        .orderBy(asc(comments.id))
        .get();
      return t(first?.id === comment.id ? "mail.comments.newThread" : "mail.comments.reply", {
        by: comment.authorName,
        path: thread.path,
        quote: thread.anchorExact.length > 80 ? `${thread.anchorExact.slice(0, 80)}…` : thread.anchorExact,
        body: excerpt,
        url: `${config.adminOrigin}/books/${bookId}/edit?thread=${thread.id}`,
      });
    });
    const subject =
      items.length === 1
        ? t("mail.comments.subjectOne", { title: book.title })
        : t("mail.comments.subjectMany", { count: items.length, title: book.title });
    try {
      await mailer.send({
        to: user.email,
        subject,
        text: t("mail.comments.body", {
          title: book.title,
          name: getInstanceSettings(db).name,
          items: lines.join("\n\n"),
          settingsUrl: `${config.adminOrigin}/books/${bookId}`,
        }),
      });
    } catch (error) {
      // Kept in the queue; the next run tries again.
      console.error(`Sending "${subject}" failed:`, error);
      continue;
    }
    drop();
    db.update(bookMembers)
      .set({ commentMailSentAt: new Date(now) })
      .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, userId)))
      .run();
  }
}
