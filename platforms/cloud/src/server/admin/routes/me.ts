import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { changeEmailInput, changePasswordInput, updateMeInput } from "../../../shared/schemas";
import type { Locale } from "../../../shared/i18n";
import { audit } from "../../audit";
import { hashPassword, verifyPassword } from "../../auth/password";
import { deleteUserSessions } from "../../auth/sessions";
import { users } from "../../db/schema";
import type { Deps } from "../../deps";
import { getEntitlements } from "../../domain/entitlements";
import { storageOf } from "../../domain/storage";
import { createT, requestLocale } from "../../i18n";
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
      const { displayName, locale } = c.req.valid("json");
      const patch: { displayName?: string; locale?: Locale | null } = {};
      if (displayName !== undefined) patch.displayName = displayName;
      // Null is a real value here: it clears the choice.
      if (locale !== undefined) patch.locale = locale;
      if (Object.keys(patch).length > 0) {
        db.update(users).set(patch).where(eq(users.id, user.id)).run();
      }
      return c.json({ ok: true as const });
    })

    .put("/email", validate("json", changeEmailInput), async (c) => {
      const user = c.get("user");
      const { email, currentPassword } = c.req.valid("json");
      const t = createT(requestLocale(c));
      const row = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
        throw new HTTPException(400, { message: t("errors.me.wrongCurrentPassword") });
      }
      if (email !== row.email) {
        const taken = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
        if (taken) throw new HTTPException(409, { message: t("errors.users.emailExists") });
        db.update(users).set({ email }).where(eq(users.id, user.id)).run();
        // Other devices are logged out; this one stays.
        deleteUserSessions(db, user.id, c.get("sessionIdHash"));
        audit(db, {
          actorUserId: user.id,
          action: "email.change",
          targetType: "user",
          targetId: user.id,
          data: { from: row.email, to: email },
        });
      }
      return c.json({ ok: true as const });
    })

    .put("/password", validate("json", changePasswordInput), async (c) => {
      const user = c.get("user");
      const { currentPassword, newPassword } = c.req.valid("json");
      const row = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
        throw new HTTPException(400, { message: createT(requestLocale(c))("errors.me.wrongCurrentPassword") });
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
