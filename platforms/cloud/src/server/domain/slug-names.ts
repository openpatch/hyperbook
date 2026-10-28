import { HTTPException } from "hono/http-exception";
import type { SessionUser } from "../auth/sessions";
import { readableSecret } from "../crypto/tokens";
import type { Db } from "../db/client";
import { getInstanceSettings } from "./instance";

/*
 * Suffix mode (instance setting slugSuffix): teachers name their books, and
 * the platform appends a suffix that belongs to the book, so nobody can take
 * a short generic address like "physik" for themselves. Those are granted by
 * admins on request (admin/routes/slug-requests.ts).
 */

export const SUFFIX_LENGTH = 4;

/** Whether `user`'s choice of address gets a suffix. Admins choose freely. */
export function suffixApplies(db: Db, user: Pick<SessionUser, "role">): boolean {
  return user.role !== "admin" && getInstanceSettings(db).slugSuffix;
}

export function newSlugSuffix(): string {
  return readableSecret(SUFFIX_LENGTH);
}

/**
 * The address for `name` with the book's suffix. A name that already ends in
 * the suffix (the teacher kept it while editing) is taken as it is.
 */
export function withSuffix(name: string, suffix: string): string {
  const ending = `-${suffix}`;
  const base = name.endsWith(ending) ? name.slice(0, -ending.length) : name;
  if (base.length + ending.length > 63) {
    throw new HTTPException(400, {
      message: `Use at most ${63 - ending.length} characters; the address gets “${ending}” at the end`,
    });
  }
  return base + ending;
}
