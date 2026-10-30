import { useId, useState } from "react";
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
    label: "Private books",
    hint: "May make a book visible only to its logged-in students.",
  },
  {
    key: "custom_domain",
    label: "Custom domains",
    hint: "May serve a book on its own domain (not available yet).",
  },
  {
    key: "ai",
    label: "AI assistant",
    hint: "May use the AI writing assistant in the editor (needs the instance to be configured for it).",
  },
] as const;

const LIMITS = [
  { key: "max_books", label: "Books", unit: "books", hint: "How many books the user may own." },
  {
    key: "max_storage_mb",
    label: "Storage",
    unit: "MB",
    hint: "Space for all owned books (enforced once books are hosted).",
  },
  {
    key: "ai_requests_per_day",
    label: "AI requests",
    unit: "/ day",
    hint: "How many AI requests the user may make per day.",
  },
  {
    key: "ai_tokens_per_week",
    label: "AI credits",
    unit: "/ week",
    hint: "AI tokens per week, counted times the model's weight (AI_MODEL_WEIGHTS); the week starts on Monday (UTC).",
  },
] as const;

/**
 * Edits per-key overrides. "Default" removes the override, so the key follows
 * `defaults` (the instance defaults, or the built-in ones on the settings page).
 */
export function EntitlementsEditor({
  value,
  defaults,
  defaultLabel = "Instance default",
  onSave,
}: {
  value: Overrides;
  defaults: Entitlements;
  defaultLabel?: string;
  onSave: (overrides: Overrides) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Overrides>(value);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Entitlements, v: Entitlements[keyof Entitlements] | undefined) =>
    setDraft((d) => {
      const next = { ...d };
      if (v === undefined) delete next[key];
      else (next as Record<string, unknown>)[key] = v;
      return next;
    });

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
          label={label}
          hint={hint}
          value={draft[key] === undefined ? "default" : draft[key] ? "yes" : "no"}
          options={[
            { value: "default", label: `${defaultLabel} (${defaults[key] ? "allowed" : "not allowed"})` },
            { value: "yes", label: "Allowed" },
            { value: "no", label: "Not allowed" },
          ]}
          onChange={(v) => set(key, v === "default" ? undefined : v === "yes")}
        />
      ))}
      {LIMITS.map(({ key, label, unit, hint }) => {
        const current = draft[key];
        const mode = current === undefined ? "default" : current === null ? "unlimited" : "limit";
        const fallback = defaults[key];
        return (
          <ChoiceRow
            key={key}
            label={label}
            hint={hint}
            value={mode}
            options={[
              {
                value: "default",
                label: `${defaultLabel} (${fallback === null ? "unlimited" : `${fallback} ${unit}`})`,
              },
              { value: "unlimited", label: "Unlimited" },
              { value: "limit", label: "Limited to…" },
            ]}
            onChange={(v) =>
              set(key, v === "default" ? undefined : v === "unlimited" ? null : (fallback ?? 10))
            }
          >
            {mode === "limit" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  aria-label={`${label} limit`}
                  value={current ?? 0}
                  onChange={(e) => set(key, Math.max(0, Number(e.target.value) || 0))}
                />
                <span className="text-sm text-muted-foreground">{unit}</span>
              </div>
            )}
          </ChoiceRow>
        );
      })}
      <div>
        <Button type="submit" disabled={saving}>
          Save
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
