import { useState } from "react";
import { Controller } from "react-hook-form";
import { Link, Navigate } from "react-router";
import { z } from "zod";
import { signupInput } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance } from "@/lib/session";
import { privacyHref } from "./legal";

const schema = signupInput
  .extend({ confirm: z.string(), acceptPrivacy: z.boolean() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match" })
  .refine((v) => v.acceptPrivacy, { path: ["acceptPrivacy"], message: "Accept the privacy policy to sign up" });

export function SignupPage() {
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
        <h1 className="text-2xl">Check your email</h1>
        <p>
          We sent a link to <strong>{sent.email}</strong>. Open it within 24 hours to confirm your address.
        </p>
        {sent.approval && <p>After that, an admin approves your account; you get an email when it is ready.</p>}
        <Link to="/login" className="text-sm text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  const error = form.formState.errors.acceptPrivacy?.message;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">Sign up</h1>
      {instance?.signupMode === "domains" && (
        <p className="text-sm text-muted-foreground">
          For addresses at {instance.signupDomains.join(", ")}.
        </p>
      )}
      <TextField form={form} name="displayName" label="Your name" autoComplete="name" autoFocus />
      <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
      <TextField
        form={form}
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
      />
      <TextField form={form} name="confirm" label="Repeat the password" type="password" autoComplete="new-password" />
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
            <span>
              I accept the{" "}
              <a href={privacyHref(instance)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                privacy policy
              </a>
              .
            </span>
          </Label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <FormError form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Sign up
      </Button>
      <Link to="/login" className="text-sm text-primary hover:underline">
        I have an account
      </Link>
    </form>
  );
}
