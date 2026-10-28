import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { changePasswordInput, updateMeInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import { hashPassword, verifyPassword } from "../../auth/password";
import { deleteUserSessions } from "../../auth/sessions";
import { users } from "../../db/schema";
import type { Deps } from "../../deps";
import { getEntitlements } from "../../domain/entitlements";
import { storageOf } from "../../domain/storage";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { validate } from "../validate";

export function meRoutes({ db }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)
    .get("/", (c) => {
      const user = c.get("user");
      return c.json({ ...user, entitlements: getEntitlements(db, user), storage: storageOf(db, user) });
    })

    .patch("/", validate("json", updateMeInput), (c) => {
      const user = c.get("user");
      const { displayName } = c.req.valid("json");
      db.update(users).set({ displayName }).where(eq(users.id, user.id)).run();
      return c.json({ ok: true as const });
    })

    .put("/password", validate("json", changePasswordInput), async (c) => {
      const user = c.get("user");
      const { currentPassword, newPassword } = c.req.valid("json");
      const row = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
        throw new HTTPException(400, { message: "The current password is wrong" });
      }
      db.update(users)
        .set({ passwordHash: await hashPassword(newPassword) })
        .where(eq(users.id, user.id))
        .run();
      // Other devices are logged out; this one stays.
      deleteUserSessions(db, user.id, c.get("sessionIdHash"));
      audit(db, {
        actorUserId: user.id,
        action: "password.change",
        targetType: "user",
        targetId: user.id,
      });
      return c.json({ ok: true as const });
    });
}
