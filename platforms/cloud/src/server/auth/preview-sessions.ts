import { and, eq, gt, lt } from "drizzle-orm";
import { randomToken, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { bookLinks, bookMembers, previewCodes, previewSessions, users } from "../db/schema";
import { isLive } from "../domain/links";

/*
 * Teachers look at the preview of their book on <slug>--preview.<BOOKS_DOMAIN>.
 * The admin session never reaches book hosts, so the editor hands a one-time
 * code over (like "view as student") and the preview host turns it into a
 * session of its own. Only hashes of codes and tokens are stored.
 */

export const PREVIEW_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const PREVIEW_CODE_LIFETIME_MS = 60 * 1000;

/** Who the preview is for: a teacher, or a visitor through an access link. */
export type PreviewViewer = { userId: number; linkId?: null } | { userId?: null; linkId: number };

export function createPreviewCode(db: Db, viewer: PreviewViewer, bookId: number, now = Date.now()) {
  const code = randomToken();
  db.insert(previewCodes)
    .values({
      codeHash: sha256(code),
      userId: viewer.userId ?? null,
      linkId: viewer.linkId ?? null,
      bookId,
      expiresAt: new Date(now + PREVIEW_CODE_LIFETIME_MS),
    })
    .run();
  return code;
}

/** Redeems a code of `bookId` once and returns a session token; null if unknown, used or expired. */
export function redeemPreviewCode(db: Db, code: string, bookId: number, now = Date.now()): string | null {
  const codeHash = sha256(code);
  return db.transaction((tx) => {
    const row = tx.select().from(previewCodes).where(eq(previewCodes.codeHash, codeHash)).get();
    if (!row) return null;
    tx.delete(previewCodes).where(eq(previewCodes.codeHash, codeHash)).run();
    if (row.expiresAt.getTime() <= now || row.bookId !== bookId) return null;
    const token = randomToken();
    tx.insert(previewSessions)
      .values({
        idHash: sha256(token),
        userId: row.userId,
        linkId: row.linkId,
        bookId,
        expiresAt: new Date(now + PREVIEW_SESSION_LIFETIME_MS),
      })
      .run();
    return token;
  });
}

/**
 * Whether `token` lets its teacher (or link visitor) see the preview of
 * `bookId`. Checked on every request, so a teacher removed from the book, or
 * a deleted link, loses the preview at once.
 */
export function readPreviewSession(db: Db, token: string, bookId: number, now = Date.now()): boolean {
  const session = db
    .select()
    .from(previewSessions)
    .where(
      and(
        eq(previewSessions.idHash, sha256(token)),
        eq(previewSessions.bookId, bookId),
        gt(previewSessions.expiresAt, new Date(now)),
      ),
    )
    .get();
  if (!session) return false;
  if (session.linkId !== null) {
    const link = db.select().from(bookLinks).where(eq(bookLinks.id, session.linkId)).get();
    return !!link && link.bookId === bookId && isLive(link, now);
  }
  if (session.userId === null) return false;
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user || user.disabledAt) return false;
  if (user.role === "admin") return true;
  return !!db
    .select({ role: bookMembers.role })
    .from(bookMembers)
    .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, user.id)))
    .get();
}

export function deleteExpiredPreviewSessions(db: Db, now = Date.now()) {
  db.delete(previewSessions).where(lt(previewSessions.expiresAt, new Date(now))).run();
  db.delete(previewCodes).where(lt(previewCodes.expiresAt, new Date(now))).run();
}
