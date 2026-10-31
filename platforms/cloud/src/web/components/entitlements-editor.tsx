import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, unwrap } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MessageKey } from "../../shared/i18n";

export type Entitlements = {
  private_books: boolean;
  max_books: number | null;
  max_storage_mb: number | null;
  custom_domain: boolean;
  ai: boolean;
  ai_requests_per_day: number | null;
  ai_tokens_per_week: number | null;
};
export type Overrides = Partial<Entitlements>;

const FLAGS = [
  {
    key: "private_books",
    label: "entitlements.privateBooks" as MessageKey,
    hint: "entitlements.privateBooksHint" as MessageKey,
  },
  {
    key: "custom_domain",
    label: "entitlements.customDomains" as MessageKey,
    hint: "entitlements.customDomainsHint" as MessageKey,
  },
  {
    key: "ai",
    label: "entitlements.ai" as MessageKey,
    hint: "entitlements.aiHint" as MessageKey,
  },
] as const;

const LIMITS = [
  {
    key: "max_books",
    label: "entitlements.maxBooks" as MessageKey,
    unit: "entitlements.booksUnit" as MessageKey,
    hint: "entitlements.maxBooksHint" as MessageKey,
  },
  {
    key: "max_storage_mb",
    label: "entitlements.storage" as MessageKey,
    unit: "entitlements.mbUnit" as MessageKey,
    hint: "entitlements.storageHint" as MessageKey,
  },
  {
    key: "ai_requests_per_day",
    label: "entitlements.aiRequests" as MessageKey,
    unit: "entitlements.perDayUnit" as MessageKey,
    hint: "entitlements.aiRequestsHint" as MessageKey,
  },
  {
    key: "ai_tokens_per_week",
    label: "entitlements.aiCredits" as MessageKey,
    unit: "entitlements.perWeekUnit" as MessageKey,
    hint: "entitlements.aiCreditsHint" as MessageKey,
  },
] as const;

/**
 * Edits per-key overrides. "Default" removes the override, so the key follows
 * `defaults` (the instance defaults, or the built-in ones on the settings page).
 */
export function EntitlementsEditor({
  value,
  defaults,
  defaultLabel,
  onSave,
}: {
  value: Overrides;
  defaults: Entitlements;
  defaultLabel?: string;
  onSave: (overrides: Overrides) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  // The AI-credit hint names the configured value of one credit.
  const { data: instanceSettings } = useQuery({
    queryKey: ["instance", "settings"],
    queryFn: () => unwrap(api.instance.$get()),
    retry: false,
  });
  const creditValueEur = instanceSettings?.ai?.creditValueEur;
  const [draft, setDraft] = useState<Overrides>(value);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Entitlements, v: Entitlements[keyof Entitlements] | undefined) =>
    setDraft((d) => {
      const next = { ...d };
      if (v === undefined) delete next[key];
      else (next as Record<string, unknown>)[key] = v;
      return next;
    });

  const fallbackLabel = defaultLabel ?? t("entitlements.instanceDefault");

  return (
    <form
      className="grid max-w-xl gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(draft);
        } finally {
          setSaving(false);
        }
      }}
    >
      {FLAGS.map(({ key, label, hint }) => (
        <ChoiceRow
          key={key}
          label={t(label)}
          hint={t(hint)}
          value={draft[key] === undefined ? "default" : draft[key] ? "yes" : "no"}
          options={[
            {
              value: "default",
              label: `${fallbackLabel} (${defaults[key] ? t("entitlements.allowed") : t("entitlements.notAllowed")})`,
            },
            { value: "yes", label: t("entitlements.yes") },
            { value: "no", label: t("entitlements.no") },
          ]}
          onChange={(v) => set(key, v === "default" ? undefined : v === "yes")}
        />
      ))}
      {LIMITS.map(({ key, label, unit, hint }) => {
        const current = draft[key];
        const mode = current === undefined ? "default" : current === null ? "unlimited" : "limit";
        const fallback = defaults[key];
        // The AI-credit limit shows its approximate euro cost next to the unit.
        const effective = mode === "limit" ? (current ?? 0) : fallback;
        const euroHint =
          key === "ai_tokens_per_week" && creditValueEur !== undefined && effective !== null
            ? ` (${t("entitlements.approxEuro", {
                amount: (effective * creditValueEur).toLocaleString(i18n.language, {
                  maximumFractionDigits: 2,
                }),
              })})`
            : "";
        return (
          <ChoiceRow
            key={key}
            label={t(label)}
            hint={
              key === "ai_tokens_per_week" && creditValueEur !== undefined
                ? t(hint, { value: creditValueEur })
                : t(hint)
            }
            value={mode}
            options={[
              {
                value: "default",
                label: `${fallbackLabel} (${fallback === null ? t("entitlements.unlimited") : `${fallback} ${t(unit)}${euroHint}`})`,
              },
              { value: "unlimited", label: t("entitlements.unlimitedChoice") },
              { value: "limit", label: t("entitlements.limitedTo") },
            ]}
            onChange={(v) =>
              set(key, v === "default" ? undefined : v === "unlimited" ? null : (fallback ?? 10))
            }
          >
            {mode === "limit" && (
              <div className="flex flex-nowrap items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-36 shrink-0"
                  aria-label={t("entitlements.limitAria", { label: t(label) })}
                  value={(current ?? 0).toLocaleString(i18n.language)}
                  // Dots, commas and spaces are only for reading: 1.000.000 is 1000000.
                  onChange={(e) => set(key, Number(e.target.value.replace(/\D/g, "")) || 0)}
                />
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {t(unit)}
                  {euroHint}
                </span>
              </div>
            )}
          </ChoiceRow>
        );
      })}
      <div>
        <Button type="submit" disabled={saving}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function ChoiceRow({
  label,
  hint,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-72" aria-describedby={`${id}-hint`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
