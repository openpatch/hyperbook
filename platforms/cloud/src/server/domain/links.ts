import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { Config } from "../config";
import { open, seal } from "../crypto/sealed";
import { randomToken, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { bookLinks, linkSessions } from "../db/schema";

/*
 * Access links: an owner gives one person a link into a book's editor, as a
 * commenter or an editor, without an account. Opening it trades the token
 * (in the URL's fragment, so it reaches no logs) for a session cookie valid
 * for that one book. Every request checks the link, so deleting it, or its
 * expiry, ends the visitor's sessions at once.
 */

export type LinkRow = typeof bookLinks.$inferSelect;
export type LinkRole = LinkRow["role"];

/** Who is behind a link session. */
export type LinkVisitor = {
  linkId: number;
  bookId: number;
  name: string;
  role: LinkRole;
  /** The session cookie's hash, to end it on leave. */
  idHash: string;
};

/** Sliding, like account sessions. */
export const LINK_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function linkUrl(config: Config, token: string) {
  return `${config.adminOrigin}/join#t=${token}`;
}

/** Whether a link still lets anyone in. */
export function isLive(link: Pick<LinkRow, "revokedAt" | "expiresAt">, now = Date.now()) {
  return link.revokedAt === null && (link.expiresAt === null || link.expiresAt.getTime() > now);
}

export function createLink(
  db: Db,
  config: Config,
  values: { bookId: number; name: string; role: LinkRole; expiresAt: Date | null; createdBy: number },
) {
  const token = randomToken();
  const link = db
    .insert(bookLinks)
    .values({
      ...values,
      tokenHash: sha256(token),
      tokenSealed: seal(config.credentialsKey, token),
    })
    .returning()
    .get();
  return { link, url: linkUrl(config, token) };
}

/** The link again, for the owner to copy; null if the key changed. */
export function revealLink(config: Config, link: LinkRow): string | null {
  const token = open(config.credentialsKey, link.tokenSealed);
  return token === null ? null : linkUrl(config, token);
}

/** The book's links that still work, newest first. */
export function liveLinks(db: Db, bookId: number, now = Date.now()) {
  return db
    .select()
    .from(bookLinks)
    .where(
      and(
        eq(bookLinks.bookId, bookId),
        isNull(bookLinks.revokedAt),
        or(isNull(bookLinks.expiresAt), gt(bookLinks.expiresAt, new Date(now))),
      ),
    )
    .all()
    .sort((a, b) => b.id - a.id);
}

/** Deletes a link: nobody gets in with it anymore. The row stays for the names. */
export function revokeLink(db: Db, linkId: number, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(bookLinks).set({ revokedAt: new Date(now) }).where(eq(bookLinks.id, linkId)).run();
    tx.delete(linkSessions).where(eq(linkSessions.linkId, linkId)).run();
  });
}

/** Trades a link's token for a session token; null if the link does not work (anymore). */
export function redeemLink(
  db: Db,
  token: string,
  now = Date.now(),
): { sessionToken: string; link: LinkRow } | null {
  const link = db.select().from(bookLinks).where(eq(bookLinks.tokenHash, sha256(token))).get();
  if (!link || !isLive(link, now)) return null;
  const sessionToken = randomToken();
  db.transaction((tx) => {
    tx.insert(linkSessions)
      .values({
        idHash: sha256(sessionToken),
        linkId: link.id,
        expiresAt: new Date(now + LINK_SESSION_LIFETIME_MS),
        lastSeenAt: new Date(now),
      })
      .run();
    tx.update(bookLinks).set({ lastUsedAt: new Date(now) }).where(eq(bookLinks.id, link.id)).run();
  });
  return { sessionToken, link };
}

/** The visitor behind a session cookie, if its session and its link are both alive. */
export function readLinkSession(db: Db, token: string, now = Date.now()): LinkVisitor | null {
  const idHash = sha256(token);
  const row = db
    .select({ session: linkSessions, link: bookLinks })
    .from(linkSessions)
    .innerJoin(bookLinks, eq(bookLinks.id, linkSessions.linkId))
    .where(and(eq(linkSessions.idHash, idHash), gt(linkSessions.expiresAt, new Date(now))))
    .get();
  if (!row || !isLive(row.link, now)) return null;
  if (now - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(linkSessions)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + LINK_SESSION_LIFETIME_MS) })
      .where(eq(linkSessions.idHash, idHash))
      .run();
    db.update(bookLinks).set({ lastUsedAt: new Date(now) }).where(eq(bookLinks.id, row.link.id)).run();
  }
  return {
    linkId: row.link.id,
    bookId: row.link.bookId,
    name: row.link.name,
    role: row.link.role,
    idHash,
  };
}

export function deleteLinkSession(db: Db, idHash: string) {
  db.delete(linkSessions).where(eq(linkSessions.idHash, idHash)).run();
}

export function deleteExpiredLinkSessions(db: Db, now = Date.now()) {
  db.delete(linkSessions).where(lt(linkSessions.expiresAt, new Date(now))).run();
}

/** What the owner's list shows of a link. */
export function publicLink(link: LinkRow) {
  return {
    id: link.id,
    name: link.name,
    role: link.role,
    createdAt: link.createdAt.getTime(),
    expiresAt: link.expiresAt?.getTime() ?? null,
    lastUsedAt: link.lastUsedAt?.getTime() ?? null,
  };
}
