import { Hono } from "hono";
import { instanceSettingsInput, type ModelPrices } from "../../../shared/schemas";
import { audit } from "../../audit";
import type { Deps } from "../../deps";
import { HTTPException } from "hono/http-exception";
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

/** Approximate USD→EUR for auto-fetched prices; the fields stay editable after. */
const EUR_PER_USD = 0.92;

let providerPrices: { baseUrl: string; at: number; prices: Record<string, ModelPrices> } | null = null;

/** €/M tokens, rounded to 4 decimals so the settings' fields stay readable. */
const eurPerM = (usdPerM: number) => Math.round(usdPerM * EUR_PER_USD * 10_000) / 10_000;

/**
 * Model prices in €/M tokens, for the settings' "fetch prices" button: the
 * provider's own /models `pricing` when it has any (OpenRouter-style, USD per
 * token), else a models.dev-compatible catalog (USD per 1M). A missing cache
 * rate falls back to 10% of input, the Mistral convention. Cached briefly.
 */
async function listProviderPrices(ai: NonNullable<Deps["config"]["ai"]>): Promise<Record<string, ModelPrices>> {
  if (providerPrices && providerPrices.baseUrl === ai.baseUrl && Date.now() - providerPrices.at < PROVIDER_MODELS_TTL_MS) {
    return providerPrices.prices;
  }
  const response = await fetch(`${ai.baseUrl}/models`, {
    headers: { authorization: `Bearer ${ai.apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const json = (await response.json()) as {
    data?: { id?: unknown; pricing?: Record<string, unknown> }[];
    models?: { id?: unknown; pricing?: Record<string, unknown> }[];
  };
  const entries = json.data ?? json.models ?? [];
  const fromProvider: Record<string, ModelPrices> = {};
  for (const entry of entries) {
    if (typeof entry?.id !== "string" || !entry.pricing) continue;
    const input = Number(entry.pricing.prompt);
    const output = Number(entry.pricing.completion);
    const cached = Number(entry.pricing.input_cache_read ?? NaN);
    if (![input, output].every((n) => Number.isFinite(n) && n > 0)) continue;
    // USD per token → €/M tokens.
    fromProvider[entry.id.trim()] = {
      in: eurPerM(input * 1_000_000),
      cached: eurPerM((Number.isFinite(cached) && cached > 0 ? cached : input * 0.1) * 1_000_000),
      out: eurPerM(output * 1_000_000),
    };
  }
  if (Object.keys(fromProvider).length > 0) {
    providerPrices = { baseUrl: ai.baseUrl, at: Date.now(), prices: fromProvider };
    return fromProvider;
  }
  // The provider lists no prices: ask a models.dev-compatible catalog (USD/M).
  const catalogResponse = await fetch(ai.pricesUrl, { signal: AbortSignal.timeout(10_000) });
  if (!catalogResponse.ok) throw new Error(`status ${catalogResponse.status}`);
  const catalog = (await catalogResponse.json()) as Record<
    string,
    { models?: Record<string, { cost?: Record<string, unknown> }> }
  >;
  const prices: Record<string, ModelPrices> = {};
  for (const provider of Object.values(catalog)) {
    for (const [id, model] of Object.entries(provider.models ?? {})) {
      const cost = model?.cost;
      const input = Number(cost?.input);
      const output = Number(cost?.output);
      const cached = Number(cost?.cache_read ?? NaN);
      if (![input, output].every((n) => Number.isFinite(n) && n > 0)) continue;
      prices[id.trim()] = {
        in: eurPerM(input),
        cached: eurPerM(Number.isFinite(cached) && cached > 0 ? cached : input * 0.1),
        out: eurPerM(output),
      };
    }
  }
  providerPrices = { baseUrl: ai.baseUrl, at: Date.now(), prices };
  return prices;
}
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
      creditValueEur: settings.aiCreditValueEur,
      costBuffer: settings.aiCostBuffer,
      // Models from the settings carry their entered prices; environment-only
      // models have none yet (prices: null) and weigh 1 per kind until set.
      models:
        settings.aiModels.length > 0
          ? settings.aiModels.map((m) => ({ id: m.id, prices: m.prices, label: m.label ?? "" }))
          : (ai?.models ?? []).map((id) => ({ id, prices: null, label: ai?.modelLabels?.[id] ?? "" })),
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
    // One-time price lookup for the settings' "fetch prices" button: fills the
    // €/M fields, which stay editable by hand afterwards.
    .get("/ai/prices", async (c) => {
      if (!config.ai) {
        throw new HTTPException(503, { message: "The AI provider is not configured" });
      }
      try {
        return c.json({ prices: await listProviderPrices(config.ai) });
      } catch {
        throw new HTTPException(502, { message: "The prices could not be fetched" });
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
