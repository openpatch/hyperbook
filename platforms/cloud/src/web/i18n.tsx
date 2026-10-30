import { useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { useEffect } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import {
  LOCALES,
  type Locale,
  catalogs,
  isMessageKey,
  parseAcceptLanguage,
} from "../shared/i18n";
import { api, unwrap } from "./lib/api";
import { useInstance, useMe } from "./lib/session";

/*
 * The web app's i18n: i18next fed with the shared catalogs (src/shared/i18n),
 * so pages, API errors and emails use the same words. The active language is
 * the signed-in user's choice, else the instance default, else the choice
 * stored in this browser, else the browser language (LocaleSync keeps it in
 * step); it is written to <html lang> and, pre-paint, by public/lang.js.
 */

const STORAGE_KEY = "locale";

export const resources = {
  en: { translation: catalogs.en },
  de: { translation: catalogs.de },
} as const;

/** The choice stored in this browser; null: follow the instance, then the browser. */
export function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : null;
  } catch {
    return null;
  }
}

function browserLocale(): Locale | null {
  return parseAcceptLanguage([...(navigator.languages ?? []), navigator.language].join(","));
}

/** Before /me and /instance answer: the stored choice, else the browser. */
const initialLocale = storedLocale() ?? browserLocale() ?? "en";

i18next.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes values itself.
});

i18next.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18next.language ?? "en";

export function useLocale(): Locale {
  return (LOCALES as readonly string[]).includes(i18next.language) ? (i18next.language as Locale) : "en";
}

/**
 * Keeps the active language in step with the account and the instance:
 * the user's choice, else the instance default, else the stored choice,
 * else the browser.
 */
export function LocaleSync() {
  const { data: me } = useMe();
  const { data: instance } = useInstance();
  useEffect(() => {
    const desired = me?.locale ?? instance?.defaultLocale ?? storedLocale() ?? browserLocale() ?? "en";
    if (desired !== i18next.language) void i18next.changeLanguage(desired);
  }, [me?.locale, instance?.defaultLocale]);
  return null;
}

/**
 * Sets the language: stored in this browser and, when logged in, saved to
 * the account. `null` means "automatic" and clears the stored choice.
 */
export function useSetLocale() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  return async (locale: Locale | null) => {
    try {
      if (locale) localStorage.setItem(STORAGE_KEY, locale);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing: the choice then lasts only this page load.
    }
    if (me) {
      await unwrap(api.me.$patch({ json: { locale } }));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } else {
      void i18next.changeLanguage(locale ?? browserLocale() ?? "en");
    }
  };
}

/** Translates a message when it is a catalog key (validation messages are keys). */
export function useMessage() {
  const { t } = useTranslation();
  return (message: string) => (isMessageKey(message) ? t(message) : message);
}
