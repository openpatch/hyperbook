import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { newPassword } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

// The refinement message is a catalog key; lib/form.tsx translates it.
const schema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "validation.passwordsMismatch",
  });

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  // The same page sets the first password of an invited user.
  const invite = params.get("invite") === "1";
  const [done, setDone] = useState(false);
  const form = useZodForm(schema, { defaultValues: { password: "", confirm: "" } });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await unwrap(api.auth.reset.$post({ json: { token, password } }));
      setDone(true);
    } catch (error) {
      applyServerError(form, error);
    }
  });

  if (done) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">{invite ? t("auth.reset.inviteDoneTitle") : t("auth.reset.doneTitle")}</h1>
        <p>{invite ? t("auth.reset.inviteDoneBody") : t("auth.reset.doneBody")}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.reset.login")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">{invite ? t("auth.reset.inviteTitle") : t("auth.reset.title")}</h1>
      <TextField
        form={form}
        name="password"
        label={t("auth.reset.password")}
        type="password"
        autoComplete="new-password"
        hint={t("auth.reset.passwordHint")}
        autoFocus
      />
      <TextField
        form={form}
        name="confirm"
        label={t("auth.reset.confirm")}
        type="password"
        autoComplete="new-password"
      />
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {invite ? t("auth.reset.inviteSubmit") : t("auth.reset.submit")}
      </Button>
    </form>
  );
}
