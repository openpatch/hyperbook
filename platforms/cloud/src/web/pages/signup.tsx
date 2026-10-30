import { useState } from "react";
import { Controller } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { z } from "zod";
import { signupInput } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMessage } from "@/i18n";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance } from "@/lib/session";
import { privacyHref } from "./legal";

// Refinement messages are catalog keys; lib/form.tsx translates them.
const schema = signupInput
  .extend({ confirm: z.string(), acceptPrivacy: z.boolean() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "validation.passwordsMismatch" })
  .refine((v) => v.acceptPrivacy, { path: ["acceptPrivacy"], message: "validation.acceptPrivacy" });

export function SignupPage() {
  const { t } = useTranslation();
  const say = useMessage();
  const { data: instance } = useInstance();
  const [sent, setSent] = useState<{ email: string; approval: boolean } | null>(null);
  const form = useZodForm(schema, {
    defaultValues: { displayName: "", email: "", password: "", confirm: "", acceptPrivacy: false },
  });

  if (instance && instance.signupMode === "closed") return <Navigate to="/login" replace />;

  const onSubmit = form.handleSubmit(async ({ confirm: _, ...values }) => {
    try {
      const res = await unwrap(api.auth.signup.$post({ json: { ...values, acceptPrivacy: true } }));
      setSent({ email: values.email, approval: res.approval });
    } catch (error) {
      applyServerError(form, error);
    }
  });

  if (sent) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">{t("auth.signup.sentTitle")}</h1>
        <p>
          <Trans
            i18nKey="auth.signup.sentBody"
            values={{ email: sent.email }}
            components={{ strong: <strong /> }}
          />
        </p>
        {sent.approval && <p>{t("auth.signup.sentApproval")}</p>}
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.signup.backToLogin")}
        </Link>
      </div>
    );
  }

  const error = form.formState.errors.acceptPrivacy?.message;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">{t("auth.signup.title")}</h1>
      {instance?.signupMode === "domains" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.signup.domainsHint", { domains: instance.signupDomains.join(", ") })}
        </p>
      )}
      <TextField form={form} name="displayName" label={t("auth.signup.name")} autoComplete="name" autoFocus />
      <TextField form={form} name="email" label={t("auth.signup.email")} type="email" autoComplete="email" />
      <TextField
        form={form}
        name="password"
        label={t("auth.signup.password")}
        type="password"
        autoComplete="new-password"
        hint={t("auth.signup.passwordHint")}
      />
      <TextField
        form={form}
        name="confirm"
        label={t("auth.signup.confirm")}
        type="password"
        autoComplete="new-password"
      />
      <div className="grid gap-1">
        <div className="flex items-start gap-2">
          <Controller
            control={form.control}
            name="acceptPrivacy"
            render={({ field }) => (
              <Checkbox
                id="accept-privacy"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={error !== undefined}
              />
            )}
          />
          <Label htmlFor="accept-privacy" className="font-normal leading-snug">
            <Trans
              i18nKey="auth.signup.acceptPrivacy"
              components={{
                a: (
                  <a
                    href={privacyHref(instance)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  />
                ),
              }}
            />
          </Label>
        </div>
        {error && <p className="text-sm text-destructive">{say(String(error))}</p>}
      </div>
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t("auth.signup.submit")}
      </Button>
      <Link to="/login" className="text-sm text-primary hover:underline">
        {t("auth.signup.haveAccount")}
      </Link>
    </form>
  );
}
