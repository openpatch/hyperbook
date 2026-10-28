import { and, eq, gt, lt } from "drizzle-orm";
import { randomToken, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { impersonationCodes, studentSessions, students } from "../db/schema";

/*
 * Students log in on their book's host, never on the admin origin. A session
 * is either a cookie on that host (hosted books) or a Bearer token (books
 * hosted elsewhere). Only the token's hash is stored.
 */

/** Sliding: every use pushes the expiry out again. */
export const STUDENT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
/** "Shared device": a browser-session cookie, and never longer than this. */
export const SHARED_DEVICE_LIFETIME_MS = 12 * 60 * 60 * 1000;
/** Teachers viewing a student's state. Never extended. */
export const READONLY_LIFETIME_MS = 60 * 60 * 1000;
/** How long a "view as student" hand-off code is valid. */
const IMPERSONATION_CODE_LIFETIME_MS = 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type StudentSession = {
  idHash: string;
  studentId: number;
  bookId: number;
  username: string;
  kind: "cookie" | "token";
  readonly: boolean;
  persistent: boolean;
  impersonatedBy: number | null;
};

export function createStudentSession(
  db: Db,
  options: {
    studentId: number;
    kind: "cookie" | "token";
    persistent: boolean;
    readonly?: boolean;
    impersonatedBy?: number;
  },
  now = Date.now(),
): string {
  const token = randomToken();
  const lifetime = options.readonly
    ? READONLY_LIFETIME_MS
    : options.persistent
      ? STUDENT_SESSION_LIFETIME_MS
      : SHARED_DEVICE_LIFETIME_MS;
  db.insert(studentSessions)
    .values({
      idHash: sha256(token),
      studentId: options.studentId,
      kind: options.kind,
      readonly: options.readonly ?? false,
      impersonatedBy: options.impersonatedBy ?? null,
      persistent: options.persistent && !options.readonly,
      expiresAt: new Date(now + lifetime),
      lastSeenAt: new Date(now),
    })
    .run();
  return token;
}

/** The session of `token` in `bookId`, if it is valid and of the given kind. */
export function readStudentSession(
  db: Db,
  token: string,
  kind: "cookie" | "token",
  bookId: number,
  now = Date.now(),
): StudentSession | null {
  const idHash = sha256(token);
  const row = db
    .select({
      idHash: studentSessions.idHash,
      studentId: studentSessions.studentId,
      kind: studentSessions.kind,
      readonly: studentSessions.readonly,
      persistent: studentSessions.persistent,
      impersonatedBy: studentSessions.impersonatedBy,
      lastSeenAt: studentSessions.lastSeenAt,
      bookId: students.bookId,
      username: students.username,
    })
    .from(studentSessions)
    .innerJoin(students, eq(students.id, studentSessions.studentId))
    .where(and(eq(studentSessions.idHash, idHash), gt(studentSessions.expiresAt, new Date(now))))
    .get();
  // A session belongs to one book: a token of another book is no token here.
  if (!row || row.kind !== kind || row.bookId !== bookId) return null;

  if (row.persistent && now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(studentSessions)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + STUDENT_SESSION_LIFETIME_MS) })
      .where(eq(studentSessions.idHash, idHash))
      .run();
  }
  const { lastSeenAt: _, ...session } = row;
  return session;
}

export function deleteStudentSession(db: Db, idHash: string) {
  db.delete(studentSessions).where(eq(studentSessions.idHash, idHash)).run();
}

/** Logs a student out everywhere, e.g. after a password reset. */
export function deleteSessionsOfStudent(db: Db, studentId: number) {
  db.delete(studentSessions).where(eq(studentSessions.studentId, studentId)).run();
}

/** A one-time code a teacher's browser carries to the book host. */
export function createImpersonationCode(db: Db, studentId: number, userId: number, now = Date.now()) {
  const code = randomToken();
  db.insert(impersonationCodes)
    .values({ codeHash: sha256(code), studentId, userId, expiresAt: new Date(now + IMPERSONATION_CODE_LIFETIME_MS) })
    .run();
  return code;
}

/** Redeems a code once; null if unknown, used or expired. */
export function redeemImpersonationCode(db: Db, code: string, now = Date.now()) {
  const codeHash = sha256(code);
  return db.transaction((tx) => {
    const row = tx.select().from(impersonationCodes).where(eq(impersonationCodes.codeHash, codeHash)).get();
    if (!row) return null;
    tx.delete(impersonationCodes).where(eq(impersonationCodes.codeHash, codeHash)).run();
    return row.expiresAt.getTime() > now ? row : null;
  });
}

export function deleteExpiredStudentSessions(db: Db, now = Date.now()) {
  db.delete(studentSessions).where(lt(studentSessions.expiresAt, new Date(now))).run();
  db.delete(impersonationCodes).where(lt(impersonationCodes.expiresAt, new Date(now))).run();
}
