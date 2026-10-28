import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { hashPassword } from "../auth/password";
import type { SessionUser } from "../auth/sessions";
import type { Config } from "../config";
import { seal } from "../crypto/sealed";
import { randomToken, readableSecret, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { publicOrigin } from "./custom-domains";
import { groups, students } from "../db/schema";
import { type BookRole, type BookRow, bookAccess } from "./books";

export type GroupRow = typeof groups.$inferSelect;
export type StudentRow = typeof students.$inferSelect;

export const DEFAULT_PASSWORD_LENGTH = 6;

/** The group, its book and the user's role there; 404 without access. */
export function groupAccess(
  db: Db,
  user: SessionUser,
  groupId: number,
): { group: GroupRow; book: BookRow; role: BookRole } {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) throw new HTTPException(404, { message: "Group not found" });
  try {
    return { group, ...bookAccess(db, user, group.bookId) };
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw new HTTPException(404, { message: "Group not found" });
    }
    throw error;
  }
}

export function studentAccess(db: Db, user: SessionUser, studentId: number) {
  const student = db.select().from(students).where(eq(students.id, studentId)).get();
  if (!student) throw new HTTPException(404, { message: "Student not found" });
  try {
    return { student, ...bookAccess(db, user, student.bookId) };
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw new HTTPException(404, { message: "Student not found" });
    }
    throw error;
  }
}

/** Password hashed for login and sealed for reprinting. */
export async function passwordFields(config: Config, password: string) {
  return {
    passwordHash: await hashPassword(password, "student"),
    passwordSealed: seal(config.credentialsKey, password),
  };
}

/**
 * A fresh QR login key: 192 random bits, so a plain sha256 is enough to look
 * it up, and short enough to keep the QR code small.
 */
export function loginKeyFields(config: Config) {
  const key = randomToken(24);
  return { loginKeyHash: sha256(key), loginKeySealed: seal(config.credentialsKey, key) };
}

export function generatedStudentPassword(length = DEFAULT_PASSWORD_LENGTH) {
  return readableSecret(length);
}

/**
 * The address a student's QR code opens. The key is in the fragment, so it
 * never reaches server logs, proxies or the Referer header. Hosted books
 * open the platform's login page; books hosted elsewhere open the book
 * itself, whose cloud.js logs in with the key.
 */
export function loginUrl(
  config: Config,
  book: Pick<BookRow, "slug" | "source" | "externalUrl" | "domain" | "domainVerifiedAt">,
  loginKey: string,
): string {
  if (book.source === "external" && book.externalUrl) {
    return `${book.externalUrl.replace(/#.*$/, "")}#hyperbook-key=${loginKey}`;
  }
  return `${publicOrigin(config, book)}/_hyperbook/login#k=${loginKey}`;
}

/**
 * Usernames <prefix>01, <prefix>02, … continuing after the highest number the
 * book already uses for this prefix. Numbers get as many digits as needed.
 */
export function nextUsernames(
  existing: string[],
  prefix: string,
  count: number,
): string[] {
  const pattern = new RegExp(`^${prefix.replace(/[-]/g, "\\-")}(\\d+)$`);
  let highest = 0;
  for (const name of existing) {
    const match = pattern.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  const last = highest + count;
  const width = Math.max(2, String(last).length);
  const taken = new Set(existing);
  const names: string[] = [];
  for (let n = highest + 1; names.length < count; n++) {
    const name = prefix + String(n).padStart(width, "0");
    if (!taken.has(name)) names.push(name);
  }
  return names;
}

export function usernameTaken(db: Db, bookId: number, username: string, exceptId?: number) {
  const row = db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.bookId, bookId), eq(students.username, username)))
    .get();
  return row !== undefined && row.id !== exceptId;
}

export function publicStudent(row: StudentRow) {
  return {
    id: row.id,
    groupId: row.groupId,
    username: row.username,
    lastLoginAt: row.lastLoginAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  };
}
