import { Hono } from "hono";
import { instanceSettingsInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import type { Deps } from "../../deps";
import { HTTPException } from "hono/http-exception";
import { effectiveSignupMode, getInstanceSettings, legalHref, updateInstanceSettings } from "../../domain/instance";
import { renderLegalMarkdown } from "../../domain/legal";
import type { AdminEnv, AuthedEnv } from "../env";
import { requireAdmin } from "../middleware";
import { validate } from "../validate";

/** What anyone may see, including the login page. */
export function publicInstanceRoutes({ db, config, mailer }: Deps) {
  return new Hono<AdminEnv>()
    .get("/", (c) => {
    const settings = getInstanceSettings(db);
    return c.json({
      name: settings.name,
      /** Where the legal pages are ("" when there is none). */
      imprintHref: legalHref(settings, "imprint"),
      privacyHref: legalHref(settings, "privacy"),
      booksDomain: config.booksDomain,
      booksProtocol: config.booksProtocol,
      emailEnabled: mailer.enabled,
      signupMode: effectiveSignupMode(settings, mailer.enabled),
      signupDomains: settings.signupDomains,
      slugSuffix: settings.slugSuffix,
      landingPage: settings.landingPage,
      /** Whether a git push also builds the preview of the book. */
      gitPushUpdatesPreview: settings.gitPushUpdatesPreview,
      /** Null: follow the browser's language. */
      defaultLocale: settings.defaultLocale,
    });
    })

    // The platform's own imprint or privacy policy, as safe HTML.
    .get("/legal/:page{imprint|privacy}", (c) => {
      const page = c.req.param("page") as "imprint" | "privacy";
      const settings = getInstanceSettings(db);
      const markdown = page === "imprint" ? settings.imprintMarkdown : settings.privacyMarkdown;
      if (!markdown.trim()) throw new HTTPException(404, { message: "This page is not written yet" });
      return c.json({ html: renderLegalMarkdown(markdown) });
    });
}

export function instanceRoutes({ db, mailer }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireAdmin)
    .get("/", (c) => c.json(getInstanceSettings(db)))
    .put("/", validate("json", instanceSettingsInput), (c) => {
      const changes = c.req.valid("json");
      if (changes.signupMode && changes.signupMode !== "closed" && !mailer.enabled) {
        throw new HTTPException(400, {
          message: "Sign-up needs email to confirm addresses. Configure SMTP first.",
        });
      }
      const after = { ...getInstanceSettings(db), ...changes };
      if (after.signupMode !== "closed" && !legalHref(after, "privacy")) {
        throw new HTTPException(400, {
          message: "Sign-up asks people to accept the privacy policy. Add one (a link or your own text) first.",
        });
      }
      updateInstanceSettings(db, changes);
      audit(db, {
        actorUserId: c.get("user").id,
        action: "instance.update",
        targetType: "instance",
        data: { keys: Object.keys(changes) },
      });
      return c.json(getInstanceSettings(db));
    });
}
