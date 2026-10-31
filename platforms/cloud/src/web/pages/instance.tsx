import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LOCALES, type Locale, type MessageKey } from "../../shared/i18n";
import { instanceSettingsInput, type ElementRuntime, type ModelPrices } from "../../shared/schemas";
import { EntitlementsEditor, type Entitlements } from "@/components/entitlements-editor";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInstance } from "@/lib/session";
import { api, unwrap } from "@/lib/api";
import { FormError, TextAreaField, TextField, applyServerError, useZodForm } from "@/lib/form";

/** Mirrors BUILTIN_ENTITLEMENTS on the server. */
export const BUILTIN_ENTITLEMENTS: Entitlements = {
  private_books: false,
  max_books: null,
  max_storage_mb: null,
  custom_domain: false,
  ai: true,
  ai_requests_per_day: null,
  ai_tokens_per_week: null,
};

const generalSchema = instanceSettingsInput
  .pick({
    name: true,
    imprintUrl: true,
    privacyUrl: true,
    imprintMarkdown: true,
    privacyMarkdown: true,
    slugSuffix: true,
    landingPage: true,
    gitPushUpdatesPreview: true,
    defaultLocale: true,
  })
  .required()
  .extend({ reservedSlugs: z.string() });

export function InstancePage() {
  const { data: settings } = useQuery({
    queryKey: ["instance"],
    queryFn: () => unwrap(api.instance.$get()),
  });
  if (!settings) return null;
  return <InstanceForms settings={settings} />;
}

function InstanceForms({
  settings,
}: {
  settings: Awaited<ReturnType<typeof loadSettings>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useZodForm(generalSchema, {
    defaultValues: {
      name: settings.name,
      imprintUrl: settings.imprintUrl,
      privacyUrl: settings.privacyUrl,
      imprintMarkdown: settings.imprintMarkdown,
      privacyMarkdown: settings.privacyMarkdown,
      reservedSlugs: settings.reservedSlugs.join("\n"),
      slugSuffix: settings.slugSuffix,
      landingPage: settings.landingPage,
      gitPushUpdatesPreview: settings.gitPushUpdatesPreview,
      defaultLocale: settings.defaultLocale ?? null,
    },
  });

  const save = async (json: z.input<typeof instanceSettingsInput>) => {
    await unwrap(api.instance.$put({ json }));
    await queryClient.invalidateQueries({ queryKey: ["instance"] });
    toast.success(t("common.saved"));
  };

  const onSubmit = form.handleSubmit(async ({ reservedSlugs, ...rest }) => {
    try {
      await save({
        ...rest,
        reservedSlugs: reservedSlugs
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (error) {
      applyServerError(form, error);
    }
  });

  return (
    <>
      <PageHeader
        title={t("instanceSettings.title")}
        description={t("instanceSettings.description")}
      />
      <Section title={t("instanceSettings.general")}>
        <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
          <TextField
            form={form}
            name="name"
            label={t("instanceSettings.name")}
            hint={t("instanceSettings.nameHint")}
          />
          <TextField
            form={form}
            name="imprintUrl"
            label={t("instanceSettings.imprintUrl")}
            type="url"
            hint={t("instanceSettings.imprintUrlHint")}
          />
          <TextAreaField
            form={form}
            name="imprintMarkdown"
            label={t("instanceSettings.imprintMarkdown")}
            hint={t("instanceSettings.imprintMarkdownHint")}
          />
          <TextField
            form={form}
            name="privacyUrl"
            label={t("instanceSettings.privacyUrl")}
            type="url"
            hint={t("instanceSettings.privacyUrlHint")}
          />
          <TextAreaField
            form={form}
            name="privacyMarkdown"
            label={t("instanceSettings.privacyMarkdown")}
            hint={t("instanceSettings.privacyMarkdownHint")}
          />
          <TextAreaField
            form={form}
            name="reservedSlugs"
            label={t("instanceSettings.reservedSlugs")}
            hint={t("instanceSettings.reservedSlugsHint")}
          />
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="slug-suffix"
                checked={form.watch("slugSuffix")}
                onCheckedChange={(v) => form.setValue("slugSuffix", v === true, { shouldDirty: true })}
                aria-describedby="slug-suffix-hint"
              />
              <Label htmlFor="slug-suffix">{t("instanceSettings.slugSuffixLabel")}</Label>
            </div>
            <p id="slug-suffix-hint" className="text-sm text-muted-foreground">
              {t("instanceSettings.slugSuffixHint")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="landing-page"
                checked={form.watch("landingPage")}
                onCheckedChange={(v) => form.setValue("landingPage", v === true, { shouldDirty: true })}
                aria-describedby="landing-page-hint"
              />
              <Label htmlFor="landing-page">{t("instanceSettings.landingPageLabel")}</Label>
            </div>
            <p id="landing-page-hint" className="text-sm text-muted-foreground">
              {t("instanceSettings.landingPageHint")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="git-push-preview"
                checked={form.watch("gitPushUpdatesPreview")}
                onCheckedChange={(v) => form.setValue("gitPushUpdatesPreview", v === true, { shouldDirty: true })}
                aria-describedby="git-push-preview-hint"
              />
              <Label htmlFor="git-push-preview">{t("instanceSettings.gitPushLabel")}</Label>
            </div>
            <p id="git-push-preview-hint" className="text-sm text-muted-foreground">
              {t("instanceSettings.gitPushHint")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="default-locale">{t("instance.language")}</Label>
            <Select
              value={form.watch("defaultLocale") ?? ""}
              onValueChange={(v) =>
                form.setValue("defaultLocale", v === "" ? null : (v as Locale), { shouldDirty: true })
              }
            >
              <SelectTrigger id="default-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("common.automatic")}</SelectItem>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {t(`common.languages.${l}` as MessageKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{t("instance.languageHint")}</p>
          </div>
          <FormError form={form} />
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Section>
      <SignupSection
        mode={settings.signupMode}
        domains={settings.signupDomains}
        onSave={async (changes) => {
          await save(changes);
          await queryClient.invalidateQueries({ queryKey: ["instance", "public"] });
        }}
      />
      <RuntimesSection
        key={JSON.stringify(settings.elementRuntimes)}
        runtimes={settings.elementRuntimes}
        onSave={async (elementRuntimes) => {
          try {
            await save({ elementRuntimes });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
          }
        }}
      />
      {settings.ai.configured && (
        <AiModelsSection
          key={JSON.stringify(settings.ai)}
          models={settings.ai.models}
          defaultModel={settings.ai.defaultModel ?? ""}
          creditValueEur={settings.ai.creditValueEur}
          costBuffer={settings.ai.costBuffer}
          onSave={async (aiModels, aiDefaultModel, aiCreditValueEur, aiCostBuffer) => {
            try {
              await save({ aiModels, aiDefaultModel, aiCreditValueEur, aiCostBuffer });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
            }
          }}
        />
      )}
      <Section
        title={t("instanceSettings.entitlements")}
        description={t("instanceSettings.entitlementsDescription")}
      >
        <EntitlementsEditor
          key={JSON.stringify(settings.defaultEntitlements)}
          value={settings.defaultEntitlements}
          defaults={BUILTIN_ENTITLEMENTS}
          defaultLabel={t("entitlements.builtInDefault")}
          onSave={async (defaultEntitlements) => {
            try {
              await save({ defaultEntitlements });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
            }
          }}
        />
      </Section>
    </>
  );
}

/** The assistant's models: the default, and what each costs the token quota. */
function AiModelsSection({
  models: saved,
  defaultModel: savedDefault,
  creditValueEur: savedCreditValue,
  costBuffer: savedBuffer,
  onSave,
}: {
  models: { id: string; prices: ModelPrices | null; label?: string }[];
  defaultModel: string;
  creditValueEur: number;
  costBuffer: number;
  onSave: (
    models: { id: string; prices: ModelPrices; label?: string }[],
    defaultModel: string,
    creditValueEur: number,
    costBuffer: number,
  ) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  // The provider's model list, as suggestions for the id fields: picking is
  // the point, but typed ids stay allowed (a provider may not list its models).
  const suggestions = useQuery({
    queryKey: ["instance", "ai-models"],
    queryFn: () => unwrap(api.instance.ai.models.$get()),
    retry: false,
  });
  const [rows, setRows] = useState(
    saved.map((m) => ({
      id: m.id,
      label: m.label ?? "",
      priceIn: m.prices ? String(m.prices.in) : "",
      priceCached: m.prices ? String(m.prices.cached) : "",
      priceOut: m.prices ? String(m.prices.out) : "",
    })),
  );
  const [defaultModel, setDefaultModel] = useState(savedDefault);
  const [creditValueEur, setCreditValueEur] = useState(String(savedCreditValue));
  const [costBuffer, setCostBuffer] = useState(String(savedBuffer));
  const [busy, setBusy] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  // One-time fetch: fills the €/M fields of the listed models; they stay
  // editable by hand, and the button can be pressed again to refresh.
  const fetchPrices = async () => {
    setFetchingPrices(true);
    try {
      const { prices } = await unwrap(api.instance.ai.prices.$get());
      let filled = 0;
      setRows((current) =>
        current.map((row) => {
          const p = prices[row.id.trim()];
          if (!p) return row;
          filled += 1;
          return {
            ...row,
            priceIn: String(p.in),
            priceCached: String(p.cached),
            priceOut: String(p.out),
          };
        }),
      );
      toast.success(t("instanceSettings.aiFetchPricesDone", { count: filled }));
    } catch {
      toast.error(t("instanceSettings.aiFetchPricesFailed"));
    } finally {
      setFetchingPrices(false);
    }
  };
  const update = (
    index: number,
    change: Partial<{ id: string; label: string; priceIn: string; priceCached: string; priceOut: string }>,
  ) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const models = rows.map((r) => ({
    id: r.id.trim(),
    prices: { in: Number(r.priceIn), cached: Number(r.priceCached), out: Number(r.priceOut) },
    label: r.label.trim(),
  }));
  const invalid =
    models.length === 0 ||
    models.some((m) => !m.id || !(m.prices.in > 0) || !(m.prices.cached > 0) || !(m.prices.out > 0)) ||
    new Set(models.map((m) => m.id)).size !== models.length ||
    !(Number(creditValueEur) > 0) ||
    !(Number(costBuffer) > 0);
  const buffer = Number(costBuffer);
  const creditValue = Number(creditValueEur);
  // Credits one million tokens of a kind cost: price/M × buffer ÷ credit value.
  const creditsPerM = (pricePerM: number) =>
    creditValue > 0 && buffer > 0 && pricePerM > 0
      ? Math.round((pricePerM * buffer) / creditValue)
      : null;
  const fmt = (n: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: 0 });
  return (
    <Section title={t("instanceSettings.aiModels")} description={t("instanceSettings.aiModelsDescription")}>
      <div className="grid max-w-2xl gap-3">
        <datalist id="ai-model-suggestions">
          {(suggestions.data?.models ?? []).map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {rows.map((row, index) => {
          const perM = {
            in: creditsPerM(Number(row.priceIn)),
            cached: creditsPerM(Number(row.priceCached)),
            out: creditsPerM(Number(row.priceOut)),
          };
          return (
            <div key={index} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={row.id}
                  list="ai-model-suggestions"
                  placeholder={t("instanceSettings.aiModelName")}
                  className="min-w-44 flex-1"
                  aria-label={t("instanceSettings.aiModelName")}
                  onChange={(e) => {
                    if (defaultModel === row.id) setDefaultModel(e.target.value.trim());
                    update(index, { id: e.target.value });
                  }}
                />
                <Input
                  value={row.label}
                  maxLength={60}
                  placeholder={t("instanceSettings.aiModelLabel")}
                  className="min-w-32 flex-1"
                  aria-label={t("instanceSettings.aiModelLabel")}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="radio"
                    name="ai-default-model"
                    className="size-4"
                    checked={defaultModel === row.id.trim()}
                    aria-label={t("instanceSettings.aiModelDefault")}
                    onChange={() => setDefaultModel(row.id.trim())}
                  />
                  {t("instanceSettings.aiModelDefault")}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {t("instanceSettings.aiModelPricesGroup")}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(
                  [
                    { field: "priceIn", value: row.priceIn, key: "aiModelPriceIn" },
                    { field: "priceCached", value: row.priceCached, key: "aiModelPriceCached" },
                    { field: "priceOut", value: row.priceOut, key: "aiModelPriceOut" },
                  ] as const
                ).map(({ field, value, key }) => (
                  <div key={field} className="flex flex-nowrap items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={value}
                      className="w-28 shrink-0"
                      aria-label={t(`instanceSettings.${key}`)}
                      onChange={(e) => update(index, { [field]: e.target.value })}
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {t("instanceSettings.aiModelEurPerM")}
                    </span>
                  </div>
                ))}
              </div>
              {perM.in !== null && perM.cached !== null && perM.out !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("instanceSettings.aiModelCreditsPerM", {
                    in: fmt(perM.in),
                    cached: fmt(perM.cached),
                    out: fmt(perM.out),
                  })}
                </p>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setRows((current) => [
                ...current,
                { id: "", label: "", priceIn: "", priceCached: "", priceOut: "" },
              ])
            }
          >
            <PlusIcon /> {t("instanceSettings.aiModelAdd")}
          </Button>
          <Button variant="outline" disabled={fetchingPrices} onClick={() => void fetchPrices()}>
            <DownloadIcon /> {t("instanceSettings.aiFetchPrices")}
          </Button>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">{t("instanceSettings.aiCalcTitle")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-muted-foreground" htmlFor="ai-credit-value">
              {t("instanceSettings.aiCreditValue")}
            </label>
            <Input
              id="ai-credit-value"
              type="number"
              min="0"
              step="any"
              className="w-28"
              value={creditValueEur}
              aria-label={t("instanceSettings.aiCreditValue")}
              onChange={(e) => setCreditValueEur(e.target.value)}
            />
            <label className="text-muted-foreground" htmlFor="ai-cost-buffer">
              {t("instanceSettings.aiCostBuffer")}
            </label>
            <Input
              id="ai-cost-buffer"
              type="number"
              min="0"
              step="any"
              className="w-24"
              value={costBuffer}
              aria-label={t("instanceSettings.aiCostBuffer")}
              onChange={(e) => setCostBuffer(e.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("instanceSettings.aiModelsHint")}</p>
        <p className="text-sm text-muted-foreground">
          {suggestions.isError
            ? t("instanceSettings.aiModelListFailed")
            : t("instanceSettings.aiModelList")}
        </p>
        <div>
          <Button
            disabled={busy || invalid}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(
                  models,
                  models.some((m) => m.id === defaultModel) ? defaultModel : models[0]!.id,
                  Number(creditValueEur),
                  Number(costBuffer),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

const loadSettings = () => unwrap(api.instance.$get());

type SignupMode = "closed" | "open" | "domains" | "approval";

const MODES: Record<SignupMode, { label: MessageKey; hint: MessageKey }> = {
  closed: { label: "instanceSettings.modeClosed", hint: "instanceSettings.modeClosedHint" },
  open: { label: "instanceSettings.modeOpen", hint: "instanceSettings.modeOpenHint" },
  domains: { label: "instanceSettings.modeDomains", hint: "instanceSettings.modeDomainsHint" },
  approval: { label: "instanceSettings.modeApproval", hint: "instanceSettings.modeApprovalHint" },
};

function SignupSection({
  mode: savedMode,
  domains: savedDomains,
  onSave,
}: {
  mode: SignupMode;
  domains: string[];
  onSave: (changes: { signupMode: SignupMode; signupDomains: string[] }) => Promise<void>;
}) {
  const { data: instance } = useInstance();
  const { t } = useTranslation();
  const emailEnabled = instance?.emailEnabled ?? false;
  const [mode, setMode] = useState(savedMode);
  const [domains, setDomains] = useState(savedDomains.join("\n"));
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title={t("instanceSettings.signup")}
      description={
        emailEnabled
          ? t("instanceSettings.signupDescriptionEmail")
          : t("instanceSettings.signupDescriptionNoEmail")
      }
    >
      <div className="grid max-w-xl gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="signup-mode">{t("instanceSettings.whoMay")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as SignupMode)}>
            <SelectTrigger id="signup-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODES) as SignupMode[]).map((m) => (
                <SelectItem key={m} value={m} disabled={m !== "closed" && !emailEnabled}>
                  {t(MODES[m].label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t(MODES[mode].hint)}</p>
        </div>
        {mode === "domains" && (
          <div className="grid gap-1.5">
            <Label htmlFor="signup-domains">{t("instanceSettings.domains")}</Label>
            <Textarea
              id="signup-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="schule.de"
            />
            <p className="text-sm text-muted-foreground">{t("instanceSettings.domainsHint")}</p>
          </div>
        )}
        <div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave({
                  signupMode: mode,
                  signupDomains: domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean),
                });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

type RuntimeChoice = "local" | "cdn";

/** Mirrors the elements with a downloadable runtime (shared/schemas.ts). */
const RUNTIME_ELEMENTS: { element: ElementRuntime; label: string }[] = [
  { element: "blockflow", label: "Blockflow" },
  { element: "excalidraw", label: "Excalidraw" },
  { element: "geogebra", label: "GeoGebra" },
  { element: "onlineide", label: "Online IDE" },
  { element: "openscad", label: "OpenSCAD" },
  { element: "pyide", label: "Python (PyIDE)" },
  { element: "sqlide", label: "SQL IDE" },
  { element: "typst", label: "Typst" },
];

/**
 * Where books load the big element runtimes from: one copy extracted on this
 * instance, or each element's public CDN. Applies to books that do not decide
 * in their own hyperbook.json (elements.*.cdn), and to builds made from now
 * on.
 */
function RuntimesSection({
  runtimes,
  onSave,
}: {
  runtimes: Partial<Record<ElementRuntime, RuntimeChoice>>;
  onSave: (elementRuntimes: Partial<Record<ElementRuntime, RuntimeChoice>>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [choices, setChoices] = useState(runtimes);
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title={t("instanceSettings.runtimes")}
      description={t("instanceSettings.runtimesDescription")}
    >
      <div className="grid max-w-xl gap-3">
        {RUNTIME_ELEMENTS.map(({ element, label }) => (
          <div key={element} className="grid grid-cols-[1fr_minmax(10rem,auto)] items-center gap-4">
            <Label htmlFor={`runtime-${element}`}>{label}</Label>
            <Select
              value={choices[element] ?? "local"}
              onValueChange={(v) =>
                setChoices((current) => ({ ...current, [element]: v as RuntimeChoice }))
              }
            >
              <SelectTrigger id={`runtime-${element}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{t("instanceSettings.thisInstance")}</SelectItem>
                <SelectItem value="cdn">{t("instanceSettings.publicCdn")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
        <div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(choices);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
