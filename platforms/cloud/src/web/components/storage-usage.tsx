import { useTranslation } from "react-i18next";

/**
 * "12.3 MB of 100 MB" with a bar; just the amount when there is no limit.
 * Numbers are formatted for the active language (12,3 MB in German).
 */
export function StorageUsage({ usedBytes, limitBytes }: { usedBytes: number; limitBytes: number | null }) {
  const { t, i18n } = useTranslation();
  const mb = (bytes: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "unit",
      unit: "megabyte",
      maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0,
    }).format(bytes / 1024 / 1024);
  const share = limitBytes ? Math.min(1, usedBytes / limitBytes) : 0;
  return (
    <div className="grid max-w-sm gap-1.5">
      <p>
        {limitBytes !== null
          ? t("storage.usedOf", { used: mb(usedBytes), limit: mb(limitBytes) })
          : t("storage.noLimit", { used: mb(usedBytes) })}
      </p>
      {limitBytes !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label={t("storage.meter")}
          aria-valuemin={0}
          aria-valuemax={limitBytes}
          aria-valuenow={usedBytes}
        >
          <div
            className={share > 0.9 ? "h-full bg-destructive" : "h-full bg-primary"}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t("storage.hint")}</p>
    </div>
  );
}
