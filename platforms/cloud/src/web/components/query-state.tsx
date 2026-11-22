import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useMessage } from "@/i18n";
import { NotFoundPage } from "@/pages/not-found";

/**
 * What a page shows instead of its content while its data loads or after
 * loading failed: a quiet "Loading…", the not-found page for a 404 (a wrong
 * or deleted id), and otherwise the error with a way to try again.
 */
export function QueryState({
  error,
  retry,
  className,
}: {
  error: unknown;
  retry: () => unknown;
  className?: string;
}) {
  const { t } = useTranslation();
  const say = useMessage();
  if (!error) {
    return (
      <p role="status" className={className ?? "text-muted-foreground"}>
        {t("common.loading")}
      </p>
    );
  }
  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return <NotFoundPage />;
  }
  return (
    <div role="alert" className={className}>
      <p className="mb-2 text-destructive">
        {t("common.loadFailed")}{" "}
        {error instanceof Error && error.message ? say(error.message) : null}
      </p>
      <Button variant="outline" onClick={() => void retry()}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
