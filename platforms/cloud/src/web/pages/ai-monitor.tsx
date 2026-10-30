import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";

const RANGES = [7, 30, 90];
const fmt = (n: number) => n.toLocaleString();

type Totals = { requests: number; tokensIn: number; tokensOut: number; credits: number; steps: number; failed: number };

function TotalsCells({ row }: { row: Totals }) {
  return (
    <>
      <TableCell className="text-right">{fmt(row.requests)}</TableCell>
      <TableCell className="text-right">{fmt(row.tokensIn)}</TableCell>
      <TableCell className="text-right">{fmt(row.tokensOut)}</TableCell>
      <TableCell className="text-right">{fmt(row.credits)}</TableCell>
      <TableCell className="text-right">{fmt(row.failed)}</TableCell>
    </>
  );
}

function TotalsHead({ first }: { first: string }) {
  const { t } = useTranslation();
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{first}</TableHead>
        <TableHead className="text-right">{t("aiMonitor.requests")}</TableHead>
        <TableHead className="text-right">{t("aiMonitor.tokensIn")}</TableHead>
        <TableHead className="text-right">{t("aiMonitor.tokensOut")}</TableHead>
        <TableHead className="text-right">{t("aiMonitor.credits")}</TableHead>
        <TableHead className="text-right">{t("aiMonitor.failed")}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function AiMonitorPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days")) || 30;
  const userId = Number(params.get("user")) || undefined;
  const { data } = useQuery({
    queryKey: ["ai-monitor", days, userId],
    queryFn: () =>
      unwrap(
        api["ai-monitor"].$get({
          query: { days: String(days), ...(userId ? { userId: String(userId) } : {}) },
        }),
      ),
  });
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const selectedEmail = userId ? data?.byUser[0]?.email ?? data?.recent[0]?.email ?? `#${userId}` : null;

  return (
    <>
      <PageHeader
        title={t("aiMonitor.title")}
        description={selectedEmail ? t("aiMonitor.userDescription", { email: selectedEmail }) : t("aiMonitor.description")}
        actions={
          <>
            {RANGES.map((range) => (
              <Button
                key={range}
                variant={range === days ? "default" : "outline"}
                onClick={() => setParam("days", String(range))}
              >
                {t("aiMonitor.lastDays", { count: range })}
              </Button>
            ))}
            {userId && (
              <Button variant="outline" onClick={() => setParam("user", null)}>
                {t("aiMonitor.allUsers")}
              </Button>
            )}
          </>
        }
      />
      {data && (
        <div className="grid gap-8">
          <Table>
            <TotalsHead first={t("aiMonitor.total")} />
            <TableBody>
              <TableRow>
                <TableCell>{t("aiMonitor.lastDays", { count: days })}</TableCell>
                <TotalsCells row={data.total} />
              </TableRow>
            </TableBody>
          </Table>

          <section>
            <h2 className="mb-2 text-xl">{t("aiMonitor.byModel")}</h2>
            <Table>
              <TotalsHead first={t("aiMonitor.model")} />
              <TableBody>
                {data.byModel.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell>{row.model}</TableCell>
                    <TotalsCells row={row} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {!userId && (
            <section>
              <h2 className="mb-2 text-xl">{t("aiMonitor.byUser")}</h2>
              <Table>
                <TotalsHead first={t("aiMonitor.user")} />
                <TableBody>
                  {data.byUser.map((row) => (
                    <TableRow key={row.userId ?? "deleted"}>
                      <TableCell>
                        {row.userId ? (
                          <Link to={`?days=${days}&user=${row.userId}`} className="text-primary hover:underline">
                            {row.email}
                          </Link>
                        ) : (
                          t("audit.deletedUser")
                        )}
                      </TableCell>
                      <TotalsCells row={row} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xl">{t("aiMonitor.byDay")}</h2>
            <Table>
              <TotalsHead first={t("aiMonitor.day")} />
              <TableBody>
                {data.byDay.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell>{row.day}</TableCell>
                    <TotalsCells row={row} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section>
            <h2 className="mb-2 text-xl">{t("aiMonitor.recent")}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("audit.when")}</TableHead>
                  <TableHead>{t("aiMonitor.user")}</TableHead>
                  <TableHead>{t("aiMonitor.model")}</TableHead>
                  <TableHead className="text-right">{t("aiMonitor.tokensIn")}</TableHead>
                  <TableHead className="text-right">{t("aiMonitor.tokensOut")}</TableHead>
                  <TableHead className="text-right">{t("aiMonitor.steps")}</TableHead>
                  <TableHead>{t("aiMonitor.finish")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(row.at).toLocaleString()}
                    </TableCell>
                    <TableCell>{row.email ?? t("audit.deletedUser")}</TableCell>
                    <TableCell>{row.model}</TableCell>
                    <TableCell className="text-right">{fmt(row.tokensIn)}</TableCell>
                    <TableCell className="text-right">{fmt(row.tokensOut)}</TableCell>
                    <TableCell className="text-right">{row.steps}</TableCell>
                    <TableCell>{row.finish}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}
    </>
  );
}
