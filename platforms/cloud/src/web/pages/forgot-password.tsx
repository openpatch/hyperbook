import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { forgotPasswordInput } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance } from "@/lib/session";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { data: instance } = useInstance();
  const [sent, setSent] = useState(false);
  const form = useZodForm(forgotPasswordInput, { defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await unwrap(api.auth.forgot.$post({ json: values }));
      setSent(true);
    } catch (error) {
      applyServerError(form, error);
    }
  });

  if (instance && !instance.emailEnabled) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">{t("auth.forgot.title")}</h1>
        <p>{t("auth.forgot.noMail")}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.forgot.backToLogin")}
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">{t("auth.forgot.sentTitle")}</h1>
        <p>{t("auth.forgot.sentBody")}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.forgot.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">{t("auth.forgot.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("auth.forgot.hint")}</p>
      <TextField form={form} name="email" label={t("auth.forgot.email")} type="email" autoComplete="username" autoFocus />
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t("auth.forgot.submit")}
      </Button>
      <Link to="/login" className="text-sm text-primary hover:underline">
        {t("auth.forgot.backToLogin")}
      </Link>
    </form>
  );
}
