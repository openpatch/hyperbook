import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { newPassword } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";

const schema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The passwords do not match",
  });

export function ResetPasswordPage() {
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
        <h1 className="text-2xl">{invite ? "Your account is ready" : "Password changed"}</h1>
        <p>You can now log in with {invite ? "your" : "your new"} password.</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">{invite ? "Choose your password" : "Choose a new password"}</h1>
      <TextField
        form={form}
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        autoFocus
      />
      <TextField
        form={form}
        name="confirm"
        label="Repeat the new password"
        type="password"
        autoComplete="new-password"
      />
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {invite ? "Set password" : "Change password"}
      </Button>
    </form>
  );
}
