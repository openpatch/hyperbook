import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import type { Config } from "../config";
import type { Db } from "./client";
import { users } from "./schema";

/**
 * Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD, but only while
 * no admin exists: changing the variables later has no effect.
 */
export async function ensureFirstAdmin(
  db: Db,
  firstAdmin: Config["firstAdmin"],
): Promise<"created" | "exists" | "missing"> {
  const admin = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .get();
  if (admin) return "exists";
  if (!firstAdmin) return "missing";

  db.insert(users)
    .values({
      email: firstAdmin.email,
      passwordHash: await hashPassword(firstAdmin.password),
      role: "admin",
      displayName: "Admin",
      emailVerifiedAt: new Date(),
      approvedAt: new Date(),
    })
    .onConflictDoUpdate({
      // An existing teacher with this email is promoted rather than duplicated.
      target: users.email,
      set: { role: "admin", emailVerifiedAt: new Date(), approvedAt: new Date() },
    })
    .run();
  return "created";
}
