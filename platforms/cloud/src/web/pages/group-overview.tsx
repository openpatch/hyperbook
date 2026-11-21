import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Seen this recently: shown as online. */
const ONLINE_MS = 2 * 60 * 1000;

type Overview = Awaited<ReturnType<typeof loadOverview>>;
type OverviewStudent = Overview["students"][number];
const loadOverview = (id: string) => unwrap(api.groups[":id"].overview.$get({ param: { id } }));

/** One cell the teacher clicked: whose answer, to which element. */
type Picked = {
  student: OverviewStudent;
  table: string;
  key: string;
  page: string;
  n: number;
};

/** "3 days ago", in the page's language. */
function useAgo() {
  const { i18n } = useTranslation();
  const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  return (ms: number) => {
    const seconds = Math.round((ms - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, "minute");
  };
}

/**
 * The class view: students in rows, the live version's elements in columns
 * (grouped by page), a mark where a student changed an element. Times only;
 * a click opens that one answer.
 */
export function GroupOverview({
  groupId,
  onViewAs,
}: {
  groupId: string;
  onViewAs: (studentId: number) => void;
}) {
  const { t } = useTranslation();
  const ago = useAgo();
  const query = useQuery({
    queryKey: ["groups", groupId, "overview"],
    queryFn: () => loadOverview(groupId),
    // A lesson is going on: keep it fresh while the tab is open.
    refetchInterval: 30_000,
  });
  const [picked, setPicked] = useState<Picked | null>(null);
  const overview = query.data;
  if (!overview) return <QueryState error={query.error} retry={query.refetch} />;

  const total = overview.pages.reduce((sum, p) => sum + p.elements.length, 0);
  const now = Date.now();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">{t("overview.description")}</p>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/groups/${groupId}/overview.csv`} download>
            {t("overview.downloadCsv")}
          </a>
        </Button>
      </div>
      {!overview.indexed ? (
        <p className="mb-4 text-sm">{t("overview.notIndexed")}</p>
      ) : total === 0 ? (
        <p className="mb-4 text-sm">{t("overview.noTasks")}</p>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th rowSpan={2} scope="col" className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">
                {t("overview.student")}
              </th>
              {total > 0 && (
                <th rowSpan={2} scope="col" className="px-2 py-2 text-right font-medium">
                  {t("overview.done")}
                </th>
              )}
              {overview.pages.map((page) => (
                <th
                  key={page.href}
                  colSpan={page.elements.length}
                  scope="colgroup"
                  className="border-l px-2 py-1 text-left font-medium"
                >
                  <span className="block max-w-48 truncate" title={page.title}>
                    {page.title}
                  </span>
                </th>
              ))}
              <th rowSpan={2} scope="col" className="border-l px-2 py-2 font-medium" title={t("overview.elsewhereHint")}>
                {t("overview.elsewhere")}
              </th>
            </tr>
            <tr className="border-b bg-muted/50">
              {overview.pages.flatMap((page) =>
                page.elements.map((e, i) => (
                  <th
                    key={`${page.href}/${e.table}/${e.id}`}
                    scope="col"
                    title={e.name}
                    className={cn("w-8 px-1 py-1 text-center font-normal text-muted-foreground", i === 0 && "border-l")}
                  >
                    {i + 1}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {overview.students.map((s) => {
              const online = s.lastSeenAt !== null && now - s.lastSeenAt < ONLINE_MS;
              const done = Object.keys(s.cells).length;
              return (
                <tr key={s.id} className="border-b last:border-b-0">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-1.5 text-left font-mono font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn("size-2 rounded-full", online ? "bg-primary" : "bg-transparent")}
                        title={online ? t("overview.online") : undefined}
                        aria-label={online ? t("overview.online") : undefined}
                        role={online ? "img" : undefined}
                      />
                      {s.username}
                    </span>
                  </th>
                  {total > 0 && (
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {t("overview.doneOf", { done, total })}
                    </td>
                  )}
                  {overview.pages.flatMap((page) =>
                    page.elements.map((e, i) => {
                      const at = s.cells[`${e.table}/${e.id}`];
                      const state = at ? t("overview.changed", { when: ago(at) }) : t("overview.notYet");
                      const label = t("overview.cellLabel", {
                        username: s.username,
                        page: page.title,
                        n: i + 1,
                        state,
                      });
                      return (
                        <td key={`${page.href}/${e.table}/${e.id}`} className={cn("p-0 text-center", i === 0 && "border-l")}>
                          {at ? (
                            <button
                              type="button"
                              title={state}
                              aria-label={label}
                              className="grid h-8 w-full place-items-center hover:bg-muted"
                              onClick={() => setPicked({ student: s, table: e.table, key: e.id, page: page.title, n: i + 1 })}
                            >
                              <span className="size-3 rounded-full bg-primary" />
                            </button>
                          ) : (
                            <span className="grid h-8 place-items-center" title={state} aria-label={label} role="img">
                              <span className="size-3 rounded-full border border-muted-foreground/30" />
                            </span>
                          )}
                        </td>
                      );
                    }),
                  )}
                  <td className="border-l px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                    {s.elsewhere || ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AnswerDialog picked={picked} onClose={() => setPicked(null)} onViewAs={onViewAs} />
    </>
  );
}

/** The saved value, readable: a text answer, files, or the raw data. */
function Answer({ data }: { data: unknown }) {
  const value = (data ?? {}) as Record<string, unknown>;
  if (typeof value.text === "string") {
    return <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">{value.text || "—"}</p>;
  }
  const files = Array.isArray(value.files) ? (value.files as { path?: unknown; content?: unknown }[]) : null;
  if (files?.every((f) => typeof f.content === "string")) {
    return (
      <div className="space-y-3">
        {files.map((f, i) => (
          <div key={i}>
            {typeof f.path === "string" && <div className="mb-1 font-mono text-xs text-muted-foreground">{f.path}</div>}
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{String(f.content)}</pre>
          </div>
        ))}
      </div>
    );
  }
  const { id: _id, ...rest } = value;
  return <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(rest, null, 2)}</pre>;
}

function AnswerDialog({
  picked,
  onClose,
  onViewAs,
}: {
  picked: Picked | null;
  onClose: () => void;
  onViewAs: (studentId: number) => void;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["students", picked?.student.id, "row", picked?.table, picked?.key],
    enabled: picked !== null,
    queryFn: () =>
      unwrap(
        api.students[":id"].row.$get({
          param: { id: String(picked!.student.id) },
          query: { table: picked!.table, key: picked!.key },
        }),
      ),
  });
  return (
    <Dialog open={picked !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {picked && t("overview.answerTitle", { username: picked.student.username, page: picked.page, n: picked.n })}
          </DialogTitle>
          <DialogDescription>
            {query.data && new Date(query.data.editedAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        {query.data ? <Answer data={query.data.data} /> : <QueryState error={query.error} retry={query.refetch} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => picked && onViewAs(picked.student.id)}>
            {t("group.viewAs")}
          </Button>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
