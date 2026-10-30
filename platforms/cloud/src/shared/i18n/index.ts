import { de } from "./locales/de";
import { en, type Messages } from "./locales/en";

export type { Messages };

/*
 * One catalog for the web app, the API and the emails: the web app feeds it
 * to i18next (src/web/i18n.tsx), the server translates with createT. Keys are
 * dot paths into the catalog, e.g. "auth.login.title"; {{name}} in a message
 * is filled from the params.
 */

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const catalogs: Record<Locale, Messages> = { en, de };

/** All dot-separated leaf paths, e.g. "auth.login.title". */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? `${K}.${Paths<T[K]>}` : K;
}[keyof T & string];
export type MessageKey = Paths<Messages>;

export function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Whether `key` names a message of the catalog (validation messages are keys). */
export function isMessageKey(key: string): key is MessageKey {
  return lookup(catalogs.en, key) !== undefined;
}

/** Fills {{name}} placeholders; unknown placeholders are left as they are. */
export function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * The server-side translator. A key missing in `locale` falls back to
 * English, then to the key itself.
 */
export function createT(locale: Locale) {
  return (key: MessageKey, params?: Record<string, unknown>): string => {
    const template = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key;
    return interpolate(template, params);
  };
}

export type T = ReturnType<typeof createT>;

/** All leaf keys of a catalog, flattened — tests compare the locales with it. */
export function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : flattenKeys(value as unknown as Messages, `${prefix}${key}.`),
  );
}

/**
 * The best supported locale in an Accept-Language header, by quality value:
 * "de-AT,de;q=0.9,en;q=0.8" is "de". Null when no listed language is supported.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const accepted = header
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const value = q === undefined ? 1 : Number.parseFloat(q.trim().slice(2));
      return { tag: (rawTag ?? "").trim().toLowerCase(), q: Number.isNaN(value) ? 0 : value };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of accepted) {
    const base = tag.split("-")[0] ?? "";
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}
