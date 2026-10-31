import { Hono } from "hono";
import { instanceSettingsInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import type { Deps } from "../../deps";
import { HTTPException } from "hono/http-exception";
import { modelWeights } from "../../domain/ai-usage";
import { effectiveAi, effectiveSignupMode, getInstanceSettings, legalHref, updateInstanceSettings } from "../../domain/instance";
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

/**
 * The provider's model list for the settings' pick fields, so an admin picks
 * ids instead of typing them. Cached briefly — it is a hint for the settings
 * page, not a live dependency.
 */
const PROVIDER_MODELS_TTL_MS = 60_000;
let providerModels: { baseUrl: string; at: number; models: string[] } | null = null;

async function listProviderModels(ai: NonNullable<Deps["config"]["ai"]>): Promise<string[]> {
  if (
    providerModels &&
    providerModels.baseUrl === ai.baseUrl &&
    Date.now() - providerModels.at < PROVIDER_MODELS_TTL_MS
  ) {
    return providerModels.models;
  }
  const response = await fetch(`${ai.baseUrl}/models`, {
    headers: { authorization: `Bearer ${ai.apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  // The OpenAI shape ({ data: [{ id }] }); some providers use `models` instead.
  const json = (await response.json()) as {
    data?: { id?: unknown }[];
    models?: { id?: unknown }[];
  };
  const models = [
    ...new Set(
      (json.data ?? json.models ?? [])
        .map((m) => (typeof m?.id === "string" ? m.id.trim() : ""))
        .filter(Boolean),
    ),
  ].sort();
  providerModels = { baseUrl: ai.baseUrl, at: Date.now(), models };
  return models;
}

/** The settings, plus the AI models in effect (the environment's when none are saved). */
function settingsView(deps: Deps) {
  const settings = getInstanceSettings(deps.db);
  const ai = effectiveAi(deps.config, settings);
  return {
    ...settings,
    ai: {
      /** The provider is set up — this is where the models get picked. */
      configured: deps.config.ai !== null,
      defaultModel: ai?.model ?? null,
      models: (ai?.models ?? []).map((id) => ({
        id,
        weights: modelWeights(ai?.modelWeights ?? {}, id),
        label: ai?.modelLabels?.[id] ?? "",
      })),
    },
  };
}

export function instanceRoutes(deps: Deps) {
  const { db, mailer, config } = deps;
  return new Hono<AuthedEnv>()
    .use(requireAdmin)
    .get("/", (c) => c.json(settingsView(deps)))
    // What the provider offers, for the settings' model pick fields. A
    // provider that does not answer (or is not configured) must not block
    // the settings: the fields accept typed ids all the same.
    .get("/ai/models", async (c) => {
      if (!config.ai) {
        throw new HTTPException(503, { message: "The AI provider is not configured" });
      }
      try {
        return c.json({ models: await listProviderModels(config.ai) });
      } catch {
        throw new HTTPException(502, { message: "The provider did not list its models" });
      }
    })
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
      if (after.aiDefaultModel && after.aiModels.length > 0 && !after.aiModels.some((m) => m.id === after.aiDefaultModel)) {
        throw new HTTPException(400, { message: "The default model must be one of the models" });
      }
      updateInstanceSettings(db, changes);
      audit(db, {
        actorUserId: c.get("user").id,
        action: "instance.update",
        targetType: "instance",
        data: { keys: Object.keys(changes) },
      });
      return c.json(settingsView(deps));
    });
}
