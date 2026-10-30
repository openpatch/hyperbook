import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LOCALES, type Locale, type MessageKey } from "../../shared/i18n";
import { instanceSettingsInput, type ElementRuntime } from "../../shared/schemas";
import { EntitlementsEditor, type Entitlements } from "@/components/entitlements-editor";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    toast.success("Saved");
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
      <PageHeader title="Settings" description="Settings for this whole instance." />
      <Section title="General">
        <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
          <TextField form={form} name="name" label="Name" hint="Shown in the header and in emails." />
          <TextField
            form={form}
            name="imprintUrl"
            label="Imprint (legal notice) URL"
            type="url"
            hint="Linked at the bottom of every page. Or leave it empty and write the imprint below."
          />
          <TextAreaField
            form={form}
            name="imprintMarkdown"
            label="Imprint text (Markdown)"
            hint="Shown at /imprint when there is no URL above."
          />
          <TextField
            form={form}
            name="privacyUrl"
            label="Privacy policy URL"
            type="url"
            hint="Linked at the bottom of every page, and accepted at sign-up. Or leave it empty and write it below."
          />
          <TextAreaField
            form={form}
            name="privacyMarkdown"
            label="Privacy policy text (Markdown)"
            hint="Shown at /privacy when there is no URL above."
          />
          <TextAreaField
            form={form}
            name="reservedSlugs"
            label="Reserved book addresses"
            hint="Addresses no book may use, one per line, in addition to built-in ones like www and api."
          />
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="slug-suffix"
                checked={form.watch("slugSuffix")}
                onCheckedChange={(v) => form.setValue("slugSuffix", v === true, { shouldDirty: true })}
                aria-describedby="slug-suffix-hint"
              />
              <Label htmlFor="slug-suffix">Teachers' addresses get an ending of their own</Label>
            </div>
            <p id="slug-suffix-hint" className="text-sm text-muted-foreground">
              Teachers name their books, and each gets a short ending (physik-edac), so nobody takes a short,
              general address for themselves. They can ask for one without the ending; admins decide under
              Addresses.
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
              <Label htmlFor="landing-page">Show a landing page at the front address</Label>
            </div>
            <p id="landing-page-hint" className="text-sm text-muted-foreground">
              The landing page introduces Hyperbook and links the ways to run it. Without it, the front address
              shows only the login screen.
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
              <Label htmlFor="git-push-preview">A git push also builds the preview</Label>
            </div>
            <p id="git-push-preview-hint" className="text-sm text-muted-foreground">
              When a teacher pushes to a book's main branch with git, its preview is rebuilt (never published
              automatically). Off by default: pushes then only update the source, so many small commits cannot
              overwhelm the build queue.
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
              Save
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
            toast.error(error instanceof Error ? error.message : "Saving failed");
          }
        }}
      />
      <Section
        title="Default entitlements"
        description="What teachers may do unless their own account says otherwise."
      >
        <EntitlementsEditor
          key={JSON.stringify(settings.defaultEntitlements)}
          value={settings.defaultEntitlements}
          defaults={BUILTIN_ENTITLEMENTS}
          defaultLabel="Built-in default"
          onSave={async (defaultEntitlements) => {
            try {
              await save({ defaultEntitlements });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Saving failed");
            }
          }}
        />
      </Section>
    </>
  );
}

const loadSettings = () => unwrap(api.instance.$get());

type SignupMode = "closed" | "open" | "domains" | "approval";

const MODES: Record<SignupMode, { label: string; hint: string }> = {
  closed: { label: "Closed", hint: "Only admins add teachers (they get an invitation by email)." },
  open: { label: "Open", hint: "Anyone can sign up after confirming their email address." },
  domains: { label: "Listed domains", hint: "Anyone with an address at one of the domains below." },
  approval: { label: "With approval", hint: "Anyone can sign up; an admin approves each account." },
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
  const emailEnabled = instance?.emailEnabled ?? false;
  const [mode, setMode] = useState(savedMode);
  const [domains, setDomains] = useState(savedDomains.join("\n"));
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title="Sign-up"
      description={
        emailEnabled
          ? "Who may make an account. New accounts confirm their email address first."
          : "Sign-up needs email, to confirm addresses. Configure SMTP to open it."
      }
    >
      <div className="grid max-w-xl gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="signup-mode">Who may sign up</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as SignupMode)}>
            <SelectTrigger id="signup-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODES) as SignupMode[]).map((m) => (
                <SelectItem key={m} value={m} disabled={m !== "closed" && !emailEnabled}>
                  {MODES[m].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{MODES[mode].hint}</p>
        </div>
        {mode === "domains" && (
          <div className="grid gap-1.5">
            <Label htmlFor="signup-domains">Domains</Label>
            <Textarea
              id="signup-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="schule.de"
            />
            <p className="text-sm text-muted-foreground">One per line. Subdomains are included.</p>
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
                toast.error(error instanceof Error ? error.message : "Saving failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
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
  const [choices, setChoices] = useState(runtimes);
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title="Element runtimes"
      description="Element runtimes (Python, Excalidraw, GeoGebra, …) are several hundred MB. This instance extracts them once and serves them to every book — faster builds, no third-party CDN for readers. Or load single elements from their public CDN. Applies to books that do not choose in their own hyperbook.json, and to builds made from now on."
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
                <SelectItem value="local">This instance</SelectItem>
                <SelectItem value="cdn">Public CDN</SelectItem>
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
                toast.error(error instanceof Error ? error.message : "Saving failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Section>
  );
}
