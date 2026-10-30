import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { api, unwrap } from "@/lib/api";

/** The link of the confirmation email lands here. */
export function VerifyPage() {
  const { t } = useTranslation();
  const token = useSearchParams()[0].get("token") ?? "";
  const verify = useMutation({ mutationFn: () => unwrap(api.auth.verify.$post({ json: { token } })) });
  useEffect(() => verify.mutate(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (verify.isError) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl">{t("auth.verify.failedTitle")}</h1>
        <p role="alert" className="text-destructive">{verify.error.message}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">{t("auth.verify.login")}</Link>
      </div>
    );
  }
  if (!verify.isSuccess) return <p className="text-muted-foreground">{t("auth.verify.confirming")}</p>;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl">{t("auth.verify.title")}</h1>
      {verify.data.pending ? (
        <p>{t("auth.verify.pendingBody")}</p>
      ) : (
        <>
          <p>{t("auth.verify.readyBody")}</p>
          <Link to="/login" className="text-sm text-primary hover:underline">{t("auth.verify.login")}</Link>
        </>
      )}
    </div>
  );
}
