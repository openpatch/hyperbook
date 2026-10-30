import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import type { MessageKey } from "../../shared/i18n";

/** The action's message key in the catalog (audit.actions.*). */
const actionKey = (action: string): MessageKey | null => {
  const name = action
    .split(".")
    .flatMap((part, i) =>
      part
        .split("-")
        .map((word, j) => (i === 0 && j === 0 ? word : word[0]!.toUpperCase() + word.slice(1))),
    )
    .join("");
  return `audit.actions.${name}` as MessageKey;
};

/** A short readable summary of the stored details. */
function details(data: Record<string, unknown> | null): string {
  if (!data) return "";
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

export function AuditPage() {
  const { t } = useTranslation();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit"],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.audit.$get({
          query: pageParam ? { before: String(pageParam), limit: "50" } : { limit: "50" },
        }),
      ),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.description")} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("audit.when")}</TableHead>
            <TableHead>{t("audit.who")}</TableHead>
            <TableHead>{t("audit.what")}</TableHead>
            <TableHead>{t("audit.details")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const key = actionKey(e.action);
            return (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>{e.actorEmail ?? t("audit.deletedUser")}</TableCell>
                <TableCell>
                  {(key && t(key)) || e.action}
                  {e.targetId !== null && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({e.targetType} {e.targetId})
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={details(e.data)}>
                  {details(e.data)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasNextPage && (
        <Button variant="outline" className="mt-4" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {t("audit.showOlder")}
        </Button>
      )}
    </>
  );
}
