import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  forgotPasswordInput,
  loginInput,
  resetPasswordInput,
  signupInput,
  verifyEmailInput,
} from "../../../shared/schemas";
import type { Locale } from "../../../shared/i18n";
import { createAccountToken, findAccountToken, useAccountToken } from "../../auth/account-tokens";
import { effectiveSignupMode, emailInDomains, getInstanceSettings } from "../../domain/instance";
import { audit } from "../../audit";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../../auth/password";
import { FailureLimiter } from "../../auth/rate-limit";
import { createSession, deleteSession, deleteUserSessions } from "../../auth/sessions";
import { users } from "../../db/schema";
import type { Deps } from "../../deps";
import { createT, requestLocale, userLocale } from "../../i18n";
import type { AdminEnv } from "../env";
import { clearSessionCookie, setSessionCookie } from "../middleware";
import { validate } from "../validate";

export function authRoutes(deps: Deps) {
  const { db, config, mailer } = deps;
  const limiter = new FailureLimiter();
  // At most 3 emails per address and hour, so nobody can flood an inbox.
  const resetMails = new FailureLimiter(3, 60 * 60 * 1000);
  const signupMails = new FailureLimiter(3, 60 * 60 * 1000);
  // Behind a reverse proxy all requests share one address, so sign-ups are
  // also limited for the whole instance.
  const signups = new FailureLimiter(50, 60 * 60 * 1000);
  const ALL = "*";

  const send = async (to: string, subject: string, text: string) => {
    try {
      await mailer.send({ to, subject, text });
    } catch (error) {
      console.error(`Sending "${subject}" failed:`, error);
    }
  };
  const instanceName = () => getInstanceSettings(db).name;

  /** The verification link, in the language of the address it goes to. */
  const sendVerification = (user: { id: number; email: string; locale: Locale | null }) => {
    const t = createT(userLocale(db, user.locale));
    const token = createAccountToken(db, user.id, "verify");
    const link = `${config.adminOrigin}/verify?token=${encodeURIComponent(token)}`;
    return send(
      user.email,
      t("mail.verify.subject", { name: instanceName() }),
      t("mail.verify.body", { name: instanceName(), link }),
    );
  };

  return new Hono<AdminEnv>()
    .post("/login", validate("json", loginInput), async (c) => {
      const t = createT(requestLocale(c));
      const { email, password } = c.req.valid("json");
      if (limiter.isBlocked(email)) {
        throw new HTTPException(429, {
          message: t("errors.auth.tooManyAttempts"),
        });
      }
      const user = db.select().from(users).where(eq(users.email, email)).get();
      // Hash even for unknown emails, so timing does not reveal which exist.
      const ok = await verifyPassword(
        password,
        user?.passwordHash ?? (await dummyPasswordHash()),
      );
      if (!user || !ok || user.disabledAt) {
        limiter.fail(email);
        throw new HTTPException(401, { message: t("errors.auth.wrongCredentials") });
      }
      limiter.succeed(email);
      // Only after the right password, so this reveals nothing to others.
      if (!user.emailVerifiedAt) {
        throw new HTTPException(403, {
          res: Response.json(
            { error: t("errors.auth.unverified"), reason: "unverified" },
            { status: 403 },
          ),
        });
      }
      if (!user.approvedAt) {
        throw new HTTPException(403, {
          res: Response.json(
            { error: t("errors.auth.pending"), reason: "pending" },
            { status: 403 },
          ),
        });
      }
      const token = createSession(db, user.id, c.req.header("user-agent") ?? "");
      setSessionCookie(c, token);
      audit(db, { actorUserId: user.id, action: "login", targetType: "session" });
      return c.json({ ok: true as const });
    })

    .post("/logout", (c) => {
      const idHash = c.get("sessionIdHash");
      if (idHash) deleteSession(db, idHash);
      clearSessionCookie(c);
      return c.json({ ok: true as const });
    })

    .post("/forgot", validate("json", forgotPasswordInput), async (c) => {
      const t = createT(requestLocale(c));
      if (!mailer.enabled) {
        throw new HTTPException(501, {
          message: t("errors.auth.noMail"),
        });
      }
      const { email } = c.req.valid("json");
      const user = db.select().from(users).where(eq(users.email, email)).get();
      // The answer is the same whether or not the account exists.
      if (user && !user.disabledAt && !resetMails.isBlocked(email)) {
        resetMails.fail(email);
        const token = createAccountToken(db, user.id, "reset");
        const link = `${config.adminOrigin}/reset-password?token=${encodeURIComponent(token)}`;
        const mt = createT(userLocale(db, user.locale));
        await send(
          user.email,
          mt("mail.reset.subject"),
          mt("mail.reset.body", { email: user.email, link }),
        );
      }
      return c.json({ ok: true as const });
    })

    .post("/reset", validate("json", resetPasswordInput), async (c) => {
      const { token, password } = c.req.valid("json");
      // Invitations set the first password the same way.
      const reset = findAccountToken(db, token, ["reset", "invite"]);
      if (!reset) {
        throw new HTTPException(400, {
          message: createT(requestLocale(c))("errors.auth.linkExpired"),
        });
      }
      const passwordHash = await hashPassword(password);
      db.transaction((tx) => {
        const user = tx.select({ verified: users.emailVerifiedAt }).from(users).where(eq(users.id, reset.userId)).get();
        // The link reached the address, which confirms it.
        tx.update(users)
          .set({ passwordHash, ...(user?.verified ? {} : { emailVerifiedAt: new Date() }) })
          .where(eq(users.id, reset.userId))
          .run();
        useAccountToken(tx as unknown as typeof db, reset.tokenHash);
      });
      deleteUserSessions(db, reset.userId);
      audit(db, {
        actorUserId: reset.userId,
        action: "password.reset",
        targetType: "user",
        targetId: reset.userId,
      });
      return c.json({ ok: true as const });
    })

    .post("/signup", validate("json", signupInput), async (c) => {
      const t = createT(requestLocale(c));
      const settings = getInstanceSettings(db);
      const mode = effectiveSignupMode(settings, mailer.enabled);
      if (mode === "closed") {
        throw new HTTPException(403, { message: t("errors.auth.signupClosed") });
      }
      const input = c.req.valid("json");
      if (mode === "domains" && !emailInDomains(input.email, settings.signupDomains)) {
        throw new HTTPException(403, {
          message: t("errors.auth.signupDomains", { domains: settings.signupDomains.join(", ") }),
        });
      }
      if (signups.isBlocked(ALL) || signupMails.isBlocked(input.email)) {
        throw new HTTPException(429, { message: t("errors.auth.tooManySignups") });
      }
      signups.fail(ALL);
      signupMails.fail(input.email);

      const existing = db.select().from(users).where(eq(users.email, input.email)).get();
      if (existing) {
        // Same answer as for a new address, so sign-up does not reveal who
        // has an account; the owner hears about it instead.
        const mt = createT(userLocale(db, existing.locale));
        await send(
          existing.email,
          mt("mail.signupExists.subject", { name: instanceName() }),
          mt("mail.signupExists.body", {
            name: instanceName(),
            loginUrl: `${config.adminOrigin}/login`,
            forgotUrl: `${config.adminOrigin}/forgot-password`,
          }),
        );
        return c.json({ ok: true as const, approval: mode === "approval" });
      }

      const now = new Date();
      const user = db
        .insert(users)
        .values({
          email: input.email,
          displayName: input.displayName,
          role: "teacher",
          passwordHash: await hashPassword(input.password),
          emailVerifiedAt: null,
          approvedAt: mode === "approval" ? null : now,
          privacyAcceptedAt: now,
        })
        .returning()
        .get();
      audit(db, { actorUserId: user.id, action: "user.signup", targetType: "user", targetId: user.id, data: { mode } });
      await sendVerification(user);
      return c.json({ ok: true as const, approval: mode === "approval" });
    })

    .post("/verify", validate("json", verifyEmailInput), async (c) => {
      const found = findAccountToken(db, c.req.valid("json").token, ["verify"]);
      if (!found) {
        throw new HTTPException(400, {
          message: createT(requestLocale(c))("errors.auth.linkExpiredLogin"),
        });
      }
      db.transaction((tx) => {
        tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, found.userId)).run();
        useAccountToken(tx as unknown as typeof db, found.tokenHash);
      });
      const user = db.select().from(users).where(eq(users.id, found.userId)).get()!;
      audit(db, { actorUserId: user.id, action: "user.verify", targetType: "user", targetId: user.id });
      if (!user.approvedAt) {
        // Admins hear about sign-ups waiting for them once the address is real.
        const admins = db
          .select({ email: users.email, locale: users.locale })
          .from(users)
          .where(eq(users.role, "admin"))
          .all();
        for (const admin of admins) {
          const t = createT(userLocale(db, admin.locale));
          const name = user.displayName || user.email;
          await send(
            admin.email,
            t("mail.approval.subject", { displayName: name }),
            t("mail.approval.body", {
              displayName: user.displayName,
              email: user.email,
              name: instanceName(),
              usersUrl: `${config.adminOrigin}/users`,
            }),
          );
        }
      }
      return c.json({ ok: true as const, pending: !user.approvedAt });
    })

    // Asked for from the login page when an address is not confirmed yet.
    .post("/verify/resend", validate("json", forgotPasswordInput), async (c) => {
      if (!mailer.enabled) {
        throw new HTTPException(501, { message: createT(requestLocale(c))("errors.auth.noMailShort") });
      }
      const { email } = c.req.valid("json");
      const user = db.select().from(users).where(eq(users.email, email)).get();
      if (user && !user.emailVerifiedAt && !user.disabledAt && !signupMails.isBlocked(email)) {
        signupMails.fail(email);
        await sendVerification(user);
      }
      return c.json({ ok: true as const });
    });
}
