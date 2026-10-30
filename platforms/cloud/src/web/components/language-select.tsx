import { useTranslation } from "react-i18next";
import { LOCALES, type Locale, type MessageKey } from "../../shared/i18n";
import { useLocale, useSetLocale } from "@/i18n";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Chooses the language of the pages. With `automatic`, a signed-in user may
 * also pick "Automatic" to follow the instance and browser again.
 */
export function LanguageSelect({ automatic = false, className }: { automatic?: boolean; className?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { data: me } = useMe();
  const showAutomatic = automatic && !!me;
  return (
    <select
      aria-label={t("common.language")}
      title={t("common.language")}
      className={cn("h-8 cursor-pointer rounded-md bg-transparent px-1 text-sm", className)}
      value={showAutomatic ? (me?.locale ?? "") : locale}
      onChange={(e) => void setLocale(e.target.value === "" ? null : (e.target.value as Locale))}
    >
      {showAutomatic && <option value="">{t("common.automatic")}</option>}
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {t(`common.languages.${l}` as MessageKey)}
        </option>
      ))}
    </select>
  );
}
