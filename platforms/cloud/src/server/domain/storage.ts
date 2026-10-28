import { and, eq, sum } from "drizzle-orm";
import type { Db } from "../db/client";
import { bookMembers, books, users } from "../db/schema";
import { getEntitlements } from "./entitlements";

/*
 * Storage quota (max_storage_mb): the current source of the books a user
 * owns, as `books.source_bytes`. Builds and history are the platform's cost.
 * A book shared by several owners counts for each of them, as it does for
 * max_books.
 */

const MB = 1024 * 1024;

export function storageUsage(db: Db, userId: number): number {
  const row = db
    .select({ bytes: sum(books.sourceBytes) })
    .from(bookMembers)
    .innerJoin(books, eq(books.id, bookMembers.bookId))
    .where(and(eq(bookMembers.userId, userId), eq(bookMembers.role, "owner")))
    .get();
  return Number(row?.bytes ?? 0);
}

export function storageOf(db: Db, user: { id: number; role: "admin" | "teacher" }) {
  const limit = getEntitlements(db, user).max_storage_mb;
  return { usedBytes: storageUsage(db, user.id), limitBytes: limit === null ? null : limit * MB };
}

/**
 * The largest size the book `bookId` may grow to under its owners' quotas,
 * with the owner whose limit sets it; null when no owner is limited. A book
 * may always stay as large as it is.
 */
export function quotaForBook(db: Db, bookId: number): { maxBytes: number; owner: string } | null {
  const book = db.select({ bytes: books.sourceBytes }).from(books).where(eq(books.id, bookId)).get();
  const current = book?.bytes ?? 0;
  const owners = db
    .select({ id: users.id, role: users.role, email: users.email })
    .from(bookMembers)
    .innerJoin(users, eq(users.id, bookMembers.userId))
    .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.role, "owner")))
    .all();
  let tightest: { maxBytes: number; owner: string } | null = null;
  for (const owner of owners) {
    const limit = getEntitlements(db, owner).max_storage_mb;
    if (limit === null) continue;
    // What is left for this book: the limit minus the owner's other books.
    const maxBytes = Math.max(current, limit * MB - (storageUsage(db, owner.id) - current));
    if (!tightest || maxBytes < tightest.maxBytes) tightest = { maxBytes, owner: owner.email };
  }
  return tightest;
}

/** The answer to a change that a quota (not the size limit of a book) refused. */
export function quotaMessage(owner: string, me: string) {
  return owner === me
    ? "This would go over your storage limit. Delete files you no longer need, or ask an admin for more space."
    : `This would go over the storage limit of ${owner}, an owner of this book.`;
}

export function setSourceBytes(db: Db, bookId: number, bytes: number) {
  db.update(books).set({ sourceBytes: bytes }).where(eq(books.id, bookId)).run();
}

/**
 * Books whose size was never recorded (from before quotas) get it from their
 * repository. Run at startup.
 */
export async function fillMissingSourceBytes(
  db: Db,
  treeBytes: (bookId: number) => Promise<number | null>,
) {
  const missing = db.select({ id: books.id }).from(books).where(eq(books.sourceBytes, 0)).all();
  for (const { id } of missing) {
    const bytes = await treeBytes(id);
    if (bytes) setSourceBytes(db, id, bytes);
  }
}
