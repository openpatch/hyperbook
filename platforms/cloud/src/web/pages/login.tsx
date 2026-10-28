import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { loginInput } from "../../shared/schemas";
import { Button } from "@/components/ui/button";
import { ApiError, api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useInstance, useMe } from "@/lib/session";

/** Only same-site paths, so the login page cannot be used to redirect elsewhere. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useZodForm(loginInput, { defaultValues: { email: "", password: "" } });
  const { data: instance } = useInstance();
  /** Set when the password was right but the address is not confirmed yet. */
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (me) return <Navigate to={next} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await unwrap(api.auth.login.$post({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(next, { replace: true });
    } catch (error) {
      setUnverified(error instanceof ApiError && error.body.reason === "unverified" ? values.email : null);
      setResent(false);
      applyServerError(form, error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <h1 className="text-2xl">Log in</h1>
      <TextField form={form} name="email" label="Email" type="email" autoComplete="username" autoFocus />
      <TextField
        form={form}
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
      />
      <FormError form={form} />
      {unverified && (
        <Button
          type="button"
          variant="outline"
          disabled={resent}
          onClick={async () => {
            await unwrap(api.auth.verify.resend.$post({ json: { email: unverified } })).catch(() => {});
            setResent(true);
          }}
        >
          {resent ? "Sent. Check your email." : "Send the link again"}
        </Button>
      )}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Log in
      </Button>
      <Link to="/forgot-password" className="text-sm text-primary hover:underline">
        Forgot your password?
      </Link>
      {instance && instance.signupMode !== "closed" && (
        <Link to="/signup" className="text-sm text-primary hover:underline">
          No account yet? Sign up
        </Link>
      )}
    </form>
  );
}
