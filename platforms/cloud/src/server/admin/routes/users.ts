import { and, count, eq, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createUserInput,
  entitlementOverridesInput,
  setPasswordInput,
  updateUserInput,
} from "../../../shared/schemas";
import type { Locale } from "../../../shared/i18n";
import { audit } from "../../audit";
import { hashPassword } from "../../auth/password";
import { deleteUserSessions } from "../../auth/sessions";
import { createAccountToken } from "../../auth/account-tokens";
import { randomToken, readableSecret } from "../../crypto/tokens";
import type { Db } from "../../db/client";
import { bookMembers, users } from "../../db/schema";
import type { Deps } from "../../deps";
import { getInstanceSettings } from "../../domain/instance";
import { storageOf } from "../../domain/storage";
import { createT, requestLocale, userLocale } from "../../i18n";
import {
  getEntitlements,
  getUserEntitlementOverrides,
  setUserEntitlementOverrides,
} from "../../domain/entitlements";
import type { AuthedEnv } from "../env";
import { requireAdmin } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

const userColumns = {
  id: users.id,
  email: users.email,
  role: users.role,
  displayName: users.displayName,
  disabledAt: users.disabledAt,
  emailVerifiedAt: users.emailVerifiedAt,
  approvedAt: users.approvedAt,
  locale: users.locale,
  createdAt: users.createdAt,
};

function publicUser(row: {
  id: number;
  email: string;
  role: "admin" | "teacher";
  displayName: string;
  disabledAt: Date | null;
  emailVerifiedAt: Date | null;
  approvedAt: Date | null;
  locale: Locale | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.displayName,
    disabled: row.disabledAt !== null,
    /** Has not followed the link sent to the address yet (sign-up or invitation). */
    unverified: row.emailVerifiedAt === null,
    /** A sign-up waiting for an admin. */
    pending: row.approvedAt === null,
    locale: row.locale,
    createdAt: row.createdAt.getTime(),
  };
}

function findUser(db: Db, id: number, locale: Locale = "en") {
  const row = db.select(userColumns).from(users).where(eq(users.id, id)).get();
  if (!row) throw new HTTPException(404, { message: createT(locale)("errors.users.notFound") });
  return row;
}

/** Generated passwords are long enough for the account policy and easy to type. */
function generatedPassword() {
  return readableSecret(14);
}

function otherActiveAdmins(db: Db, userId: number): number {
  return (
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, userId), isNull(users.disabledAt)))
      .get()?.n ?? 0
  );
}

export function userRoutes({ db, config, mailer }: Deps) {
  const send = async (to: string, subject: string, text: string) => {
    try {
      await mailer.send({ to, subject, text });
      return true;
    } catch (error) {
      console.error(`Sending "${subject}" failed:`, error);
      return false;
    }
  };

  /** A link to choose a password, in the invited user's language; following it confirms the address. */
  const invite = (user: { id: number; email: string; displayName: string; locale: Locale | null }, by: string) => {
    const t = createT(userLocale(db, user.locale));
    const token = createAccountToken(db, user.id, "invite");
    const name = getInstanceSettings(db).name;
    const link = `${config.adminOrigin}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
    return send(
      user.email,
      t("mail.invite.subject", { name }),
      t("mail.invite.body", {
        name: user.displayName ? ` ${user.displayName}` : "",
        by,
        instance: name,
        link,
        loginUrl: `${config.adminOrigin}/login`,
        email: user.email,
      }),
    );
  };

  return new Hono<AuthedEnv>()
    .use(requireAdmin)

    .get("/", (c) => {
      const rows = db.select(userColumns).from(users).orderBy(users.email).all();
      return c.json(rows.map(publicUser));
    })

    .post("/", validate("json", createUserInput), async (c) => {
      const input = c.req.valid("json");
      const exists = db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
      if (exists) {
        throw new HTTPException(409, { message: createT(requestLocale(c))("errors.users.emailExists") });
      }
      // Without a password and with email, the new user is invited to choose
      // one; otherwise a password is set (and a generated one shown once).
      const invited = !input.password && mailer.enabled;
      const password = input.password ?? generatedPassword();
      const row = db
        .insert(users)
        .values({
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          // An invited user has no password until they choose one.
          passwordHash: await hashPassword(invited ? randomToken() : password),
          // An admin vouches for the accounts they add; an invitation confirms
          // the address when it is followed.
          emailVerifiedAt: invited ? null : new Date(),
          approvedAt: new Date(),
        })
        .returning(userColumns)
        .get();
      if (invited) await invite(row, c.get("user").displayName || c.get("user").email);
      audit(db, {
        actorUserId: c.get("user").id,
        action: "user.create",
        targetType: "user",
        targetId: row.id,
        data: { email: row.email, role: row.role },
      });
      // A generated password is returned this once and never again.
      return c.json({
        user: publicUser(row),
        password: input.password || invited ? null : password,
        invited,
      });
    })

    // A sign-up waiting for an admin (sign-up mode "approval").
    .post("/:id/approve", idParam, async (c) => {
      const id = c.req.valid("param").id;
      const user = findUser(db, id, requestLocale(c));
      if (user.approvedAt) throw new HTTPException(409, { message: "This account is approved already" });
      db.update(users).set({ approvedAt: new Date() }).where(eq(users.id, id)).run();
      audit(db, { actorUserId: c.get("user").id, action: "user.approve", targetType: "user", targetId: id });
      const name = getInstanceSettings(db).name;
      const t = createT(userLocale(db, user.locale));
      await send(
        user.email,
        t("mail.approved.subject", { name }),
        t("mail.approved.body", { name, loginUrl: `${config.adminOrigin}/login`, email: user.email }),
      );
      return c.json(publicUser(findUser(db, id, requestLocale(c))));
    })

    // Sends a new invitation to someone who has not chosen a password yet.
    .post("/:id/invite", idParam, async (c) => {
      if (!mailer.enabled) {
        throw new HTTPException(501, { message: createT(requestLocale(c))("errors.auth.noMailShort") });
      }
      const user = findUser(db, c.req.valid("param").id, requestLocale(c));
      if (user.emailVerifiedAt) throw new HTTPException(409, { message: "This user has set up the account already" });
      if (!(await invite(user, c.get("user").displayName || c.get("user").email))) {
        throw new HTTPException(502, { message: "The invitation could not be sent" });
      }
      audit(db, { actorUserId: c.get("user").id, action: "user.invite", targetType: "user", targetId: user.id });
      return c.json({ ok: true as const });
    })

    .get("/:id", idParam, (c) => {
      const row = findUser(db, c.req.valid("param").id, requestLocale(c));
      return c.json({
        ...publicUser(row),
        entitlementOverrides: getUserEntitlementOverrides(db, row.id),
        entitlements: getEntitlements(db, row),
        storage: storageOf(db, row),
      });
    })

    .patch("/:id", idParam, validate("json", updateUserInput), (c) => {
      const { id } = c.req.valid("param");
      const changes = c.req.valid("json");
      const me = c.get("user");
      const row = findUser(db, id, requestLocale(c));

      if (id === me.id && (changes.disabled || changes.role === "teacher")) {
        throw new HTTPException(400, {
          message: "You cannot disable your own account or remove your own admin role",
        });
      }
      if (
        row.role === "admin" &&
        (changes.disabled || changes.role === "teacher") &&
        otherActiveAdmins(db, id) === 0
      ) {
        throw new HTTPException(400, { message: "The last admin cannot be disabled or demoted" });
      }

      db.update(users)
        .set({
          displayName: changes.displayName,
          role: changes.role,
          disabledAt:
            changes.disabled === undefined
              ? undefined
              : changes.disabled
                ? (row.disabledAt ?? new Date())
                : null,
        })
        .where(eq(users.id, id))
        .run();
      if (changes.disabled) deleteUserSessions(db, id);
      audit(db, {
        actorUserId: me.id,
        action: "user.update",
        targetType: "user",
        targetId: id,
        data: changes,
      });
      return c.json(publicUser(findUser(db, id, requestLocale(c))));
    })

    .put("/:id/password", idParam, validate("json", setPasswordInput), async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      findUser(db, id, requestLocale(c));
      const password = input.password ?? generatedPassword();
      db.update(users)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(users.id, id))
        .run();
      deleteUserSessions(db, id);
      audit(db, {
        actorUserId: c.get("user").id,
        action: "user.password.set",
        targetType: "user",
        targetId: id,
      });
      return c.json({ password: input.password ? null : password });
    })

    .put("/:id/entitlements", idParam, validate("json", entitlementOverridesInput), (c) => {
      const { id } = c.req.valid("param");
      const overrides = c.req.valid("json");
      const row = findUser(db, id, requestLocale(c));
      setUserEntitlementOverrides(db, id, overrides);
      audit(db, {
        actorUserId: c.get("user").id,
        action: "user.entitlements.set",
        targetType: "user",
        targetId: id,
        data: overrides,
      });
      return c.json({
        entitlementOverrides: getUserEntitlementOverrides(db, id),
        entitlements: getEntitlements(db, row),
      });
    })

    .delete("/:id", idParam, (c) => {
      const { id } = c.req.valid("param");
      const me = c.get("user");
      if (id === me.id) throw new HTTPException(400, { message: "You cannot delete your own account" });
      const row = findUser(db, id, requestLocale(c));
      if (row.role === "admin" && otherActiveAdmins(db, id) === 0) {
        throw new HTTPException(400, { message: "The last admin cannot be deleted" });
      }
      const soleOwned = soleOwnedBooks(db, id);
      if (soleOwned > 0) {
        throw new HTTPException(409, {
          message: `This user is the only owner of ${soleOwned} book(s). Give each book another owner or delete it first.`,
        });
      }
      db.delete(users).where(eq(users.id, id)).run();
      audit(db, {
        actorUserId: me.id,
        action: "user.delete",
        targetType: "user",
        targetId: id,
        data: { email: row.email },
      });
      return c.json({ ok: true as const });
    });
}

/** Books where this user is the only owner. */
export function soleOwnedBooks(db: Db, userId: number): number {
  const owned = db
    .select({ bookId: bookMembers.bookId })
    .from(bookMembers)
    .where(and(eq(bookMembers.userId, userId), eq(bookMembers.role, "owner")))
    .all();
  let sole = 0;
  for (const { bookId } of owned) {
    const owners =
      db
        .select({ n: count() })
        .from(bookMembers)
        .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.role, "owner")))
        .get()?.n ?? 0;
    if (owners === 1) sole++;
  }
  return sole;
}
