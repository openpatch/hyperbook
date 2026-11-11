import { and, asc, eq, inArray } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { commentThreads, comments } from "../db/schema";
import { headCommit, listTree, readBlob } from "../hosting/git";
import { repoDir } from "../hosting/storage";
import type { Actor } from "./actors";
import { type BookRole, hasRole } from "./books";
import { normalizeText, quoteOf, relocate } from "../../shared/comment-anchor";

/*
 * Comments on a book's source (docs/cloud-platform.md, M7). A thread covers
 * a range of a file: offsets into the file's text as the blob `anchorOid`
 * has it, plus that text with some context around it. When the file changes
 * outside the editor (a push, the AI, a save without the editor's mapping),
 * the text is looked for again; when it is gone, the thread is outdated.
 * Anchors are matched in src/shared/comment-anchor.ts.
 */

export { CONTEXT, quoteOf, relocate } from "../../shared/comment-anchor";

export type ThreadRow = typeof commentThreads.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;

/** A file's text as offsets count it; null for a binary file. */
export function textOf(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  return normalizeText(bytes.toString("utf8"));
}

/** The book's files at its newest save, by path: blob oid. */
async function blobsOf(config: Config, bookId: number): Promise<Map<string, string>> {
  const repo = repoDir(config, bookId);
  const commit = await headCommit(repo).catch(() => null);
  if (!commit) return new Map();
  return new Map((await listTree(repo, commit)).map((e) => [e.path, e.oid]));
}

/** The text of `path` at the newest save, with its blob oid; null when missing or binary. */
export async function currentText(
  config: Config,
  bookId: number,
  path: string,
): Promise<{ oid: string; text: string } | null> {
  const oid = (await blobsOf(config, bookId)).get(path);
  if (!oid) return null;
  const text = textOf(await readBlob(repoDir(config, bookId), oid));
  return text === null ? null : { oid, text };
}

/**
 * The book's threads (of one file, or all), each placed in the file as it
 * is now. Threads whose file changed are looked for again and the new place
 * is stored; the ones not found are `outdated`.
 */
export async function placedThreads(db: Db, config: Config, bookId: number, path?: string) {
  const rows = db
    .select()
    .from(commentThreads)
    .where(path ? and(eq(commentThreads.bookId, bookId), eq(commentThreads.path, path)) : eq(commentThreads.bookId, bookId))
    .orderBy(asc(commentThreads.id))
    .all();
  const blobs = rows.length ? await blobsOf(config, bookId) : new Map<string, string>();
  const texts = new Map<string, string | null>();
  const repo = repoDir(config, bookId);
  const placed: (ThreadRow & { outdated: boolean })[] = [];
  for (const row of rows) {
    const oid = blobs.get(row.path);
    if (row.detachedAt || !oid) {
      placed.push({ ...row, outdated: true });
      continue;
    }
    if (oid === row.anchorOid) {
      placed.push({ ...row, outdated: false });
      continue;
    }
    if (!texts.has(oid)) texts.set(oid, textOf(await readBlob(repo, oid)));
    const text = texts.get(oid)!;
    const found = text === null ? null : relocate(text, row);
    if (!found) {
      placed.push({ ...row, outdated: true });
      continue;
    }
    const moved = { anchorFrom: found.from, anchorTo: found.to, anchorOid: oid, ...quoteOf(text!, found.from, found.to) };
    db.update(commentThreads).set(moved).where(eq(commentThreads.id, row.id)).run();
    placed.push({ ...row, ...moved, outdated: false });
  }
  return placed;
}

/** Whether `actor` wrote it: links by link, accounts by account. */
export function isAuthor(actor: Actor, by: { userId: number | null; linkId: number | null }) {
  return actor.kind === "user" ? by.userId === actor.userId : by.linkId === actor.linkId;
}

/** Resolving and reopening: editors and owners any thread, commenters their own. */
export function mayResolve(actor: Actor, role: BookRole, thread: ThreadRow) {
  return hasRole(role, "editor") || isAuthor(actor, { userId: thread.createdByUserId, linkId: thread.createdByLinkId });
}

/** The threads as the editor gets them, from `actor`'s point of view. */
export function publicThreads(db: Db, threads: (ThreadRow & { outdated: boolean })[], actor: Actor, role: BookRole) {
  const ids = threads.map((t) => t.id);
  const all = ids.length
    ? db.select().from(comments).where(inArray(comments.threadId, ids)).orderBy(asc(comments.id)).all()
    : [];
  return threads.map((thread) => ({
    id: thread.id,
    path: thread.path,
    from: thread.anchorFrom,
    to: thread.anchorTo,
    oid: thread.anchorOid,
    quote: thread.anchorExact,
    prefix: thread.anchorPrefix,
    suffix: thread.anchorSuffix,
    outdated: thread.outdated,
    status: thread.status,
    createdBy: thread.createdByName,
    createdAt: thread.createdAt.getTime(),
    resolvedBy: thread.resolvedByName,
    resolvedAt: thread.resolvedAt?.getTime() ?? null,
    canResolve: mayResolve(actor, role, thread),
    comments: all
      .filter((c) => c.threadId === thread.id)
      .map((c) => ({
        id: c.id,
        author: c.authorName,
        mine: isAuthor(actor, { userId: c.authorUserId, linkId: c.authorLinkId }),
        deleted: c.deletedAt !== null,
        body: c.deletedAt ? "" : c.body,
        suggestion: c.deletedAt ? null : c.suggestion,
        appliedAt: c.appliedAt?.getTime() ?? null,
        createdAt: c.createdAt.getTime(),
        editedAt: c.editedAt?.getTime() ?? null,
      })),
  }));
}

/** Threads follow their files when a save moves them. */
export function moveThreads(db: Db, bookId: number, moves: { from: string; to: string }[]) {
  for (const { from, to } of moves) {
    db.update(commentThreads)
      .set({ path: to })
      .where(and(eq(commentThreads.bookId, bookId), eq(commentThreads.path, from)))
      .run();
  }
}
