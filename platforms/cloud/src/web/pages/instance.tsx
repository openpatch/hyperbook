import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LOCALES, type Locale, type MessageKey } from "../../shared/i18n";
import { instanceSettingsInput, type ElementRuntime, type ModelWeights } from "../../shared/schemas";
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
          onSave={async (aiModels, aiDefaultModel) => {
            try {
              await save({ aiModels, aiDefaultModel });
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
  onSave,
}: {
  models: { id: string; weights: ModelWeights; label?: string }[];
  defaultModel: string;
  onSave: (models: { id: string; weights: ModelWeights; label?: string }[], defaultModel: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(
    saved.map((m) => ({
      id: m.id,
      label: m.label ?? "",
      weightIn: String(m.weights.in),
      weightCached: String(m.weights.cached),
      weightOut: String(m.weights.out),
    })),
  );
  const [defaultModel, setDefaultModel] = useState(savedDefault);
  const [busy, setBusy] = useState(false);
  const update = (
    index: number,
    change: Partial<{ id: string; label: string; weightIn: string; weightCached: string; weightOut: string }>,
  ) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const models = rows.map((r) => ({
    id: r.id.trim(),
    weights: { in: Number(r.weightIn), cached: Number(r.weightCached), out: Number(r.weightOut) },
    label: r.label.trim(),
  }));
  const invalid =
    models.length === 0 ||
    models.some((m) => !m.id || !(m.weights.in > 0) || !(m.weights.cached > 0) || !(m.weights.out > 0)) ||
    new Set(models.map((m) => m.id)).size !== models.length;
  return (
    <Section title={t("instanceSettings.aiModels")} description={t("instanceSettings.aiModelsDescription")}>
      <div className="grid max-w-2xl gap-3">
        <div className="grid grid-cols-[1fr_1fr_5rem_5rem_5rem_5rem_2.25rem] items-center gap-2 text-sm text-muted-foreground">
          <span>{t("instanceSettings.aiModelName")}</span>
          <span>{t("instanceSettings.aiModelLabel")}</span>
          <span>{t("instanceSettings.aiModelWeightIn")}</span>
          <span>{t("instanceSettings.aiModelWeightCached")}</span>
          <span>{t("instanceSettings.aiModelWeightOut")}</span>
          <span>{t("instanceSettings.aiModelDefault")}</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_5rem_5rem_5rem_5rem_2.25rem] items-center gap-2">
            <Input
              value={row.id}
              aria-label={t("instanceSettings.aiModelName")}
              onChange={(e) => {
                if (defaultModel === row.id) setDefaultModel(e.target.value.trim());
                update(index, { id: e.target.value });
              }}
            />
            <Input
              value={row.label}
              maxLength={60}
              placeholder={row.id.trim()}
              aria-label={t("instanceSettings.aiModelLabel")}
              onChange={(e) => update(index, { label: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              step="any"
              value={row.weightIn}
              aria-label={t("instanceSettings.aiModelWeightIn")}
              onChange={(e) => update(index, { weightIn: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              step="any"
              value={row.weightCached}
              aria-label={t("instanceSettings.aiModelWeightCached")}
              onChange={(e) => update(index, { weightCached: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              step="any"
              value={row.weightOut}
              aria-label={t("instanceSettings.aiModelWeightOut")}
              onChange={(e) => update(index, { weightOut: e.target.value })}
            />
            <input
              type="radio"
              name="ai-default-model"
              className="size-4 justify-self-start"
              checked={defaultModel === row.id.trim()}
              aria-label={t("instanceSettings.aiModelDefault")}
              onChange={() => setDefaultModel(row.id.trim())}
            />
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
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setRows((current) => [
                ...current,
                { id: "", label: "", weightIn: "1", weightCached: "1", weightOut: "1" },
              ])
            }
          >
            <PlusIcon /> {t("instanceSettings.aiModelAdd")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("instanceSettings.aiModelsHint")}</p>
        <div>
          <Button
            disabled={busy || invalid}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(models, models.some((m) => m.id === defaultModel) ? defaultModel : models[0]!.id);
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
