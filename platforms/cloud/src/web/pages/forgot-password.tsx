import { useState } from "react";
import { Link } from "react-router";
import { forgotPasswordInput } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance } from "@/lib/session";

export function ForgotPasswordPage() {
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
        <h1 className="text-2xl">Forgot your password?</h1>
        <p>This instance cannot send email. Ask an admin to set a new password for you.</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">Check your email</h1>
        <p>
          If an account exists for that address, it now has an email with a link to choose a
          new password. The link works for one hour.
        </p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">Forgot your password?</h1>
      <p className="text-sm text-muted-foreground">
        Enter your email address and we will send you a link to choose a new one.
      </p>
      <TextField form={form} name="email" label="Email" type="email" autoComplete="username" autoFocus />
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Send link
      </Button>
      <Link to="/login" className="text-sm text-primary hover:underline">
        Back to log in
      </Link>
    </form>
  );
}
