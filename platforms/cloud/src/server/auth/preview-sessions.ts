import { and, eq, gt, lt } from "drizzle-orm";
import { randomToken, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { bookMembers, previewCodes, previewSessions, users } from "../db/schema";

/*
 * Teachers look at the preview of their book on <slug>--preview.<BOOKS_DOMAIN>.
 * The admin session never reaches book hosts, so the editor hands a one-time
 * code over (like "view as student") and the preview host turns it into a
 * session of its own. Only hashes of codes and tokens are stored.
 */

export const PREVIEW_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const PREVIEW_CODE_LIFETIME_MS = 60 * 1000;

export function createPreviewCode(db: Db, userId: number, bookId: number, now = Date.now()) {
  const code = randomToken();
  db.insert(previewCodes)
    .values({ codeHash: sha256(code), userId, bookId, expiresAt: new Date(now + PREVIEW_CODE_LIFETIME_MS) })
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
        bookId,
        expiresAt: new Date(now + PREVIEW_SESSION_LIFETIME_MS),
      })
      .run();
    return token;
  });
}

/**
 * Whether `token` lets its teacher see the preview of `bookId`. Checked on
 * every request, so a teacher removed from the book loses the preview at once.
 */
export function readPreviewSession(db: Db, token: string, bookId: number, now = Date.now()): boolean {
  const row = db
    .select({ userId: previewSessions.userId, role: users.role, disabledAt: users.disabledAt })
    .from(previewSessions)
    .innerJoin(users, eq(users.id, previewSessions.userId))
    .where(
      and(
        eq(previewSessions.idHash, sha256(token)),
        eq(previewSessions.bookId, bookId),
        gt(previewSessions.expiresAt, new Date(now)),
      ),
    )
    .get();
  if (!row || row.disabledAt) return false;
  if (row.role === "admin") return true;
  return !!db
    .select({ role: bookMembers.role })
    .from(bookMembers)
    .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, row.userId)))
    .get();
}

export function deleteExpiredPreviewSessions(db: Db, now = Date.now()) {
  db.delete(previewSessions).where(lt(previewSessions.expiresAt, new Date(now))).run();
  db.delete(previewCodes).where(lt(previewCodes.expiresAt, new Date(now))).run();
}
