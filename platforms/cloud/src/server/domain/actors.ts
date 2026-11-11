import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { SessionUser } from "../auth/sessions";
import type { Db } from "../db/client";
import { books } from "../db/schema";
import { type BookRole, type BookRow, bookAccess, hasRole } from "./books";
import type { LinkVisitor } from "./links";

/**
 * Who acts on a book: an account, or someone who came through an access
 * link (see links.ts). Only the routes a link visitor may use take an actor;
 * every other route takes the account alone.
 */
export type Actor =
  | { kind: "user"; user: SessionUser; name: string; userId: number; linkId: null }
  | { kind: "link"; link: LinkVisitor; name: string; userId: null; linkId: number };

/** The name an account shows under its comments and commits. */
export function userName(user: Pick<SessionUser, "displayName" | "email">) {
  return user.displayName || user.email.split("@")[0]!;
}

export function userActor(user: SessionUser): Actor {
  return { kind: "user", user, name: userName(user), userId: user.id, linkId: null };
}

/**
 * The book, the role and the actor for a route link visitors may use. An
 * account that belongs to the book (or an admin) acts as itself, even when
 * the browser also carries a link of the book; otherwise a link session of
 * that book acts. Anything else: 401 without either, 404 otherwise, so other
 * books stay unrevealed.
 */
export function visitorAccess(
  db: Db,
  user: SessionUser | null,
  link: LinkVisitor | null,
  bookId: number,
  needed: BookRole = "editor",
): { book: BookRow; role: BookRole; actor: Actor } {
  if (user) {
    try {
      const { book, role } = bookAccess(db, user, bookId, needed);
      return { book, role, actor: userActor(user) };
    } catch (error) {
      // Not a member: a link of this book may still let them in.
      if (!(error instanceof HTTPException && error.status === 404) || link?.bookId !== bookId) throw error;
    }
  }
  if (!link) throw new HTTPException(401, { message: "Not logged in" });
  if (link.bookId !== bookId) throw new HTTPException(404, { message: "Book not found" });
  const book = db.select().from(books).where(eq(books.id, bookId)).get();
  if (!book) throw new HTTPException(404, { message: "Book not found" });
  if (!hasRole(link.role, needed)) {
    throw new HTTPException(403, {
      message: needed === "owner" ? "Only owners of this book may do this" : "Commenters may not change this book",
    });
  }
  return {
    book,
    role: link.role,
    actor: { kind: "link", link, name: link.name, userId: null, linkId: link.linkId },
  };
}
