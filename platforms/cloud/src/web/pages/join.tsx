import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { api, unwrap } from "@/lib/api";

/**
 * Where an access link lands (/join#t=…). The token is in the fragment, so
 * it never reaches a server log; it is traded for the link's session cookie,
 * then the address bar is replaced, so it leaves the history too.
 */
export function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const left = useSearchParams()[0].has("left");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || left) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    // Take the token out of the address bar before anything else.
    window.history.replaceState(null, "", "/join");
    if (!token) {
      setFailed(true);
      return;
    }
    unwrap(api.links.redeem.$post({ json: { token } }))
      .then(async ({ bookId }) => {
        await queryClient.invalidateQueries({ queryKey: ["link-session"] });
        await queryClient.invalidateQueries({ queryKey: ["books", String(bookId)] });
        navigate(`/books/${bookId}/edit`, { replace: true });
      })
      .catch(() => setFailed(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (left) return <p>{t("links.left")}</p>;
  if (!failed) return <p className="text-muted-foreground">{t("links.opening")}</p>;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl">{t("links.goneTitle")}</h1>
      <p>{t("links.goneText")}</p>
    </div>
  );
}
