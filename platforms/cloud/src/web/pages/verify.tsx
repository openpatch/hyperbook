import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { api, unwrap } from "@/lib/api";

/** The link of the confirmation email lands here. */
export function VerifyPage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const verify = useMutation({ mutationFn: () => unwrap(api.auth.verify.$post({ json: { token } })) });
  useEffect(() => verify.mutate(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (verify.isError) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">This link does not work</h1>
        <p role="alert" className="text-destructive">{verify.error.message}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">Log in</Link>
      </div>
    );
  }
  if (!verify.isSuccess) return <p className="text-muted-foreground">Confirming your address…</p>;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl">Address confirmed</h1>
      {verify.data.pending ? (
        <p>An admin approves your account next. You get an email when it is ready.</p>
      ) : (
        <>
          <p>Your account is ready.</p>
          <Link to="/login" className="text-sm text-primary hover:underline">Log in</Link>
        </>
      )}
    </div>
  );
}
