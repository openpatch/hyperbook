import { z } from "zod";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { instanceSettings } from "../db/schema";
import { parseJson } from "../json";
import { LOCALES } from "../../shared/i18n";
import { ELEMENT_RUNTIMES, elementRuntimeChoice, modelPricesSchema, type ModelPrices, type ModelWeights } from "../../shared/schemas";

/**
 * Instance-wide settings, edited by admins. Stored one row per key, so adding
 * a setting needs no migration; a missing or invalid row falls back to its
 * default.
 */
export const instanceSettingsSchema = z.object({
  /** Shown in the header and in emails. */
  name: z.string().trim().min(1).max(100),
  /** Entitlements for teachers who have no override for a key. */
  defaultEntitlements: z
    .object({
      private_books: z.boolean(),
      max_books: z.number().int().min(0).nullable(),
      max_storage_mb: z.number().int().min(0).nullable(),
      custom_domain: z.boolean(),
      ai: z.boolean(),
      ai_requests_per_day: z.number().int().min(0).nullable(),
      ai_tokens_per_week: z.number().int().min(0).nullable(),
    })
    .partial(),
  /** Slugs this instance keeps for itself, on top of the built-in ones. */
  reservedSlugs: z.array(z.string().trim().toLowerCase().min(1)).max(500),
  /** Linked from every page; schools are usually required to have both. */
  imprintUrl: z.union([z.url(), z.literal("")]),
  privacyUrl: z.union([z.url(), z.literal("")]),
  /** Shown at /imprint and /privacy when there is no URL. */
  imprintMarkdown: z.string().max(100_000),
  privacyMarkdown: z.string().max(100_000),
  /**
   * Who may make an account: only admins add teachers (closed), anyone
   * (open), anyone with an address at `signupDomains` (domains), or anyone
   * after an admin approved them (approval). All but closed need email.
   */
  signupMode: z.enum(["closed", "open", "domains", "approval"]),
  /** For signupMode "domains": e.g. "schule.de" admits a@schule.de and a@x.schule.de. */
  signupDomains: z.array(z.string()).max(200),
  /**
   * Teachers' books get addresses ending in a suffix of their own
   * (physik-edac); addresses without one are granted by admins on request.
   */
  slugSuffix: z.boolean(),
  /**
   * Whether the front address shows the landing page. Off, visitors are sent
   * straight to the login screen.
   */
  landingPage: z.boolean(),
  /**
   * The language of pages, API errors and emails for users who have not
   * chosen one themselves. Null: follow the browser's Accept-Language.
   */
  defaultLocale: z.enum(LOCALES).nullable(),
  /**
   * For each element with a downloadable runtime, where books load it from
   * that do not decide in their hyperbook.json: "local" (default) from this
   * instance, "cdn" from the element's public CDN. Unlisted elements are
   * local.
   */
  elementRuntimes: z.partialRecord(z.enum(ELEMENT_RUNTIMES), elementRuntimeChoice),
  /**
   * Whether a git push to a book's main also builds the preview (a preview
   * build only — publishing stays explicit). Off by default: pushes never
   * trigger builds, so many small commits cannot overwhelm the build queue.
   */
  gitPushUpdatesPreview: z.boolean(),
  /**
   * The AI assistant's models and what each costs at the provider, per token
   * kind, in € per million tokens. The quota weights derive from these prices
   * (weightsFromPrices). Empty: the AI_MODEL and AI_MODELS of the environment
   * apply, weighing 1 per kind. The provider and its key stay in the environment.
   */
  aiModels: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        prices: modelPricesSchema,
        /** The name teachers see in the editor (e.g. "Fast"); empty: the model id. */
        label: z.string().trim().max(60).optional(),
      }),
    )
    .max(50),
  /** One of `aiModels`; null: the first. */
  aiDefaultModel: z.string().nullable(),
  /** What one AI credit is worth in € of provider cost; weights derive from it. */
  aiCreditValueEur: z.number().positive().max(1000),
  /** Markup on provider prices (failed requests, running costs): 1.3 = 30% buffer. */
  aiCostBuffer: z.number().positive().max(100),
});

export type InstanceSettings = z.infer<typeof instanceSettingsSchema>;

export const DEFAULT_INSTANCE_SETTINGS: InstanceSettings = {
  name: "Hyperbook Cloud",
  defaultEntitlements: {},
  reservedSlugs: [],
  imprintUrl: "",
  privacyUrl: "",
  imprintMarkdown: "",
  privacyMarkdown: "",
  signupMode: "closed",
  signupDomains: [],
  slugSuffix: false,
  landingPage: true,
  defaultLocale: null,
  elementRuntimes: {},
  gitPushUpdatesPreview: false,
  aiModels: [],
  aiDefaultModel: null,
  aiCreditValueEur: 0.01,
  aiCostBuffer: 1.3,
};

/**
 * The quota weights from a model's provider prices (€/M tokens): a token
 * costs price/1e6 € at the provider, and one credit is worth `creditValueEur`
 * €, so weight = (price/1e6 × buffer) / creditValueEur. With the defaults
 * (0.01 €, ×1.3), a model at 0.595 €/M input weighs 0.595 × 1.3 / 10000.
 */
export function weightsFromPrices(prices: ModelPrices, buffer: number, creditValueEur: number): ModelWeights {
  const factor = (buffer / (1_000_000 * creditValueEur));
  return { in: prices.in * factor, cached: prices.cached * factor, out: prices.out * factor };
}

/** The elements whose runtimes load from their public CDN instead of this instance. */
export function cdnElements(settings: InstanceSettings): string[] {
  return Object.entries(settings.elementRuntimes)
    .filter(([, choice]) => choice === "cdn")
    .map(([element]) => element);
}

/** Where a legal page is: its URL, the platform's own page, or nowhere (""). */
export function legalHref(settings: InstanceSettings, page: "imprint" | "privacy") {
  const url = page === "imprint" ? settings.imprintUrl : settings.privacyUrl;
  const markdown = page === "imprint" ? settings.imprintMarkdown : settings.privacyMarkdown;
  return url || (markdown.trim() ? `/${page}` : "");
}

/** The sign-up mode in effect: without email, nobody can confirm an address. */
export function effectiveSignupMode(settings: InstanceSettings, emailEnabled: boolean) {
  return emailEnabled ? settings.signupMode : "closed";
}

/** Whether `email` is at one of `domains` or a subdomain of one. */
export function emailInDomains(email: string, domains: string[]) {
  const host = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return domains.some((d) => host === d || host.endsWith("." + d));
}

/**
 * The AI configuration in effect — always with a model picked, which is why
 * this is non-null only when there is one: the environment's provider with
 * the models, default and weights an admin chose in the settings when there
 * are any, else the environment's shorthand (whose models weigh 1 per kind).
 * Null when AI is not configured at all, or the provider is but no model was
 * picked anywhere.
 */
export type EffectiveAi = NonNullable<Config["ai"]> & { model: string };

export function effectiveAi(config: Config, settings: InstanceSettings): EffectiveAi | null {
  const ai = config.ai;
  if (!ai) return null;
  if (settings.aiModels.length === 0) {
    return ai.model ? { ...ai, model: ai.model } : null;
  }
  const models = settings.aiModels.map((m) => m.id);
  const model = settings.aiDefaultModel && models.includes(settings.aiDefaultModel) ? settings.aiDefaultModel : models[0]!;
  return {
    ...ai,
    model,
    models: [model, ...models.filter((m) => m !== model)],
    modelWeights: Object.fromEntries(
      settings.aiModels.map((m) => [m.id, weightsFromPrices(m.prices, settings.aiCostBuffer, settings.aiCreditValueEur)]),
    ),
    modelLabels: Object.fromEntries(settings.aiModels.filter((m) => m.label).map((m) => [m.id, m.label!])),
  };
}

export function getInstanceSettings(db: Db): InstanceSettings {
  const rows = db.select().from(instanceSettings).all();
  const settings: Record<string, unknown> = { ...DEFAULT_INSTANCE_SETTINGS };
  for (const row of rows) {
    const field =
      instanceSettingsSchema.shape[row.key as keyof InstanceSettings];
    if (!field) continue;
    const parsed = field.safeParse(parseJson(row.value));
    if (parsed.success) settings[row.key] = parsed.data;
  }
  return settings as InstanceSettings;
}

export function updateInstanceSettings(
  db: Db,
  changes: Partial<InstanceSettings>,
) {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      tx.insert(instanceSettings)
        .values({ key, value: json })
        .onConflictDoUpdate({ target: instanceSettings.key, set: { value: json } })
        .run();
    }
  });
}
