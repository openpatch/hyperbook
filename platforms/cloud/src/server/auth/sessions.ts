import { and, eq, gt, lt, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { passwordResets, sessions, users } from "../db/schema";
import { randomToken, sha256 } from "../crypto/tokens";

/** Sliding: every use pushes the expiry out again. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
/** Writes to the session row at most this often. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionUser = {
  id: number;
  email: string;
  role: "admin" | "teacher";
  displayName: string;
};

/** Returns the token for the cookie; only its hash is stored. */
export function createSession(
  db: Db,
  userId: number,
  userAgent: string,
  now = Date.now(),
): string {
  const token = randomToken();
  db.insert(sessions)
    .values({
      idHash: sha256(token),
      userId,
      expiresAt: new Date(now + SESSION_LIFETIME_MS),
      lastSeenAt: new Date(now),
      userAgent: userAgent.slice(0, 300),
    })
    .run();
  return token;
}

export function readSession(
  db: Db,
  token: string,
  now = Date.now(),
): { user: SessionUser; idHash: string } | null {
  const idHash = sha256(token);
  const row = db
    .select({
      idHash: sessions.idHash,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      disabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, new Date(now))))
    .get();
  if (!row || row.disabledAt) return null;

  if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(sessions)
      .set({
        lastSeenAt: new Date(now),
        expiresAt: new Date(now + SESSION_LIFETIME_MS),
      })
      .where(eq(sessions.idHash, idHash))
      .run();
  }

  return {
    idHash,
    user: {
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.displayName,
    },
  };
}

export function deleteSession(db: Db, idHash: string) {
  db.delete(sessions).where(eq(sessions.idHash, idHash)).run();
}

/** Logs a user out everywhere, optionally keeping the current session. */
export function deleteUserSessions(db: Db, userId: number, keepIdHash?: string) {
  db.delete(sessions)
    .where(
      keepIdHash
        ? and(eq(sessions.userId, userId), ne(sessions.idHash, keepIdHash))
        : eq(sessions.userId, userId),
    )
    .run();
}

/** Removes expired sessions and password reset links. */
export function deleteExpired(db: Db, now = Date.now()) {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date(now))).run();
  db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date(now))).run();
}
