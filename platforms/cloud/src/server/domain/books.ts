import { and, count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { SessionUser } from "../auth/sessions";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { bookMembers, bookSlugs, books } from "../db/schema";
import { publicDomain, publicOrigin } from "./custom-domains";
import { getInstanceSettings } from "./instance";
import { RESERVED_SLUGS, checkSlug } from "./slug";

export type BookRow = typeof books.$inferSelect;
/** Admins act as owners of every book. */
export type BookRole = "owner" | "editor";

/**
 * The book and the user's role in it. Books the user has no part in answer
 * 404, so their existence is not revealed.
 */
export function bookAccess(
  db: Db,
  user: SessionUser,
  bookId: number,
  needed: BookRole = "editor",
): { book: BookRow; role: BookRole } {
  const book = db.select().from(books).where(eq(books.id, bookId)).get();
  if (!book) throw new HTTPException(404, { message: "Book not found" });
  let role: BookRole | undefined;
  if (user.role === "admin") {
    role = "owner";
  } else {
    role = db
      .select({ role: bookMembers.role })
      .from(bookMembers)
      .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, user.id)))
      .get()?.role;
  }
  if (!role) throw new HTTPException(404, { message: "Book not found" });
  if (needed === "owner" && role !== "owner") {
    throw new HTTPException(403, { message: "Only owners of this book may do this" });
  }
  return { book, role };
}

/** Adds `n` to the book's commit count (editor saves count one commit, pushes their rev-list count). */
export function addCommits(db: Db, bookId: number, n: number) {
  if (n <= 0) return;
  db.update(books)
    .set({ commitCount: sql`${books.commitCount} + ${n}` })
    .where(eq(books.id, bookId))
    .run();
}

export function ownerCount(db: Db, bookId: number): number {
  return (
    db
      .select({ n: count() })
      .from(bookMembers)
      .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.role, "owner")))
      .get()?.n ?? 0
  );
}

export function ownedBookCount(db: Db, userId: number): number {
  return (
    db
      .select({ n: count() })
      .from(bookMembers)
      .where(and(eq(bookMembers.userId, userId), eq(bookMembers.role, "owner")))
      .get()?.n ?? 0
  );
}

/**
 * Throws 400/409 unless `slug` may be used by the book `bookId` (null for a
 * new book). An address another book used before (and now redirects) may be
 * taken; the caller drops that redirect.
 */
export function assertSlugAvailable(db: Db, slug: string, bookId: number | null) {
  const reserved = new Set([...RESERVED_SLUGS, ...getInstanceSettings(db).reservedSlugs]);
  switch (checkSlug(slug, reserved)) {
    case "format":
      throw new HTTPException(400, {
        message: "Use lowercase letters, digits and hyphens; start and end with a letter or digit",
      });
    case "double-hyphen":
      throw new HTTPException(400, { message: "Two hyphens in a row are not allowed" });
    case "reserved":
      throw new HTTPException(409, { message: "This address is reserved" });
  }
  const taken = db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).get();
  if (taken && taken.id !== bookId) {
    throw new HTTPException(409, { message: "Another book uses this address already" });
  }
}

/** Gives the book a new address; the old one keeps redirecting to it. */
export function renameSlug(db: Db, book: BookRow, slug: string) {
  db.transaction((tx) => {
    tx.delete(bookSlugs).where(eq(bookSlugs.oldSlug, slug)).run();
    tx.insert(bookSlugs)
      .values({ oldSlug: book.slug, bookId: book.id })
      .onConflictDoUpdate({ target: bookSlugs.oldSlug, set: { bookId: book.id } })
      .run();
    tx.update(books).set({ slug, updatedAt: new Date() }).where(eq(books.id, book.id)).run();
  });
}

export function publicBook(config: Config, book: BookRow, role: BookRole) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    description: book.description,
    visibility: book.visibility,
    source: book.source,
    externalUrl: book.externalUrl,
    url: book.externalUrl ?? publicOrigin(config, book),
    domain: publicDomain(config, book),
    /** Suffix mode: the ending the teacher's chosen names get. */
    slugSuffix: book.slugSuffix,
    /** The address was given by an admin; only admins change it. */
    slugGranted: book.slugGrantedAt !== null,
    role,
    publishedBuildId: book.publishedBuildId,
    publishedAt: book.publishedAt?.getTime() ?? null,
    previewBuildId: book.previewBuildId,
    /** Commits on main; minus a build's commitCount gives the staleness hint. */
    commitCount: book.commitCount,
    createdAt: book.createdAt.getTime(),
    updatedAt: book.updatedAt.getTime(),
  };
}
