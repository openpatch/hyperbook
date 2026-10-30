import type { Context } from "hono";
import { createT, parseAcceptLanguage, type Locale } from "../shared/i18n";
import type { AdminEnv } from "./admin/env";
import type { Db } from "./db/client";
import { getInstanceSettings } from "./domain/instance";

export { createT };
export type { Locale };

/**
 * The locale of the request, put there by localeMiddleware (admin/middleware.ts).
 * Where that did not run (an error before it), fall back to Accept-Language.
 */
export function requestLocale(c: Context): Locale {
  try {
    const set = (c as unknown as Context<AdminEnv>).get("locale");
    if (set) return set;
  } catch {
    // No variables on this context.
  }
  return parseAcceptLanguage(c.req.header("accept-language")) ?? "en";
}

/** The locale of a user's emails: their choice, else the instance's default. */
export function userLocale(db: Db, locale: Locale | null): Locale {
  return locale ?? getInstanceSettings(db).defaultLocale ?? "en";
}
