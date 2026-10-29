import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { instanceSettingsInput } from "../../shared/schemas";
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
