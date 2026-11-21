import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Page = Overview["pages"][number];

/** A choice of the teacher, kept per group in this browser. */
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode: the choice lasts until the page is left.
    }
  };
  return [value, set] as const;
}

const cellOf = (e: Page["elements"][number]) => `${e.table}/${e.id}`;
const startsWith = (sections: string[] | undefined, prefix: string[]) =>
  prefix.every((name, i) => (sections ?? [])[i] === name);

/** Every section (and subsection) that has pages, in the book's order. */
function sectionChoices(pages: Page[]): string[][] {
  const seen = new Map<string, string[]>();
  for (const page of pages) {
    const sections = page.sections ?? [];
    for (let depth = 1; depth <= sections.length; depth++) {
      const path = sections.slice(0, depth);
      seen.set(JSON.stringify(path), path);
    }
  }
  return [...seen.values()];
}

const ALL = "__all";

/**
 * The class view: students in rows, pages in columns, how many of a page's
 * tasks each student worked on. A page opens into one column per task,
 * where a click shows the answer. Big books are narrowed to a section and,
 * by default, to the pages someone in the group worked on.
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
  const [section, setSection] = useStored<string[]>(`hb-overview-section:${groupId}`, []);
  const [onlyWorked, setOnlyWorked] = useStored(`hb-overview-worked:${groupId}`, true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Picked | null>(null);
  const overview = query.data;
  if (!overview) return <QueryState error={query.error} retry={query.refetch} />;

  const choices = sectionChoices(overview.pages);
  const inSection = overview.pages.filter((p) => startsWith(p.sections, section));
  const worked = (page: Page) =>
    page.elements.some((e) => overview.students.some((s) => cellOf(e) in s.cells));
  const pages = onlyWorked ? inSection.filter(worked) : inSection;
  const total = pages.reduce((sum, p) => sum + p.elements.length, 0);
  const now = Date.now();
  const toggle = (href: string) =>
    setOpen((old) => {
      const next = new Set(old);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  const csv = new URLSearchParams();
  if (section.length > 0) csv.set("section", JSON.stringify(section));
  if (onlyWorked) csv.set("worked", "1");

  return (
    <>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">{t("overview.description")}</p>
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        {choices.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="overview-section">{t("overview.section")}</Label>
            <Select
              value={section.length > 0 ? JSON.stringify(section) : ALL}
              onValueChange={(v) => {
                setSection(v === ALL ? [] : (JSON.parse(v) as string[]));
                setOpen(new Set());
              }}
            >
              <SelectTrigger id="overview-section" className="w-80 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("overview.wholeBook")}</SelectItem>
                {choices.map((path) => (
                  <SelectItem key={JSON.stringify(path)} value={JSON.stringify(path)}>
                    <span style={{ paddingLeft: `${(path.length - 1) * 0.75}rem` }}>{path[path.length - 1]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <label className="flex h-9 items-center gap-2 text-sm">
          <Checkbox checked={onlyWorked} onCheckedChange={(v) => setOnlyWorked(v === true)} />
          {t("overview.onlyWorked")}
        </label>
        <span className="h-9 content-center text-sm text-muted-foreground">
          {t("overview.pagesShown", { count: pages.length, all: inSection.length })}
        </span>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={`/api/groups/${groupId}/overview.csv${csv.size ? `?${csv}` : ""}`} download>
            {t("overview.downloadCsv")}
          </a>
        </Button>
      </div>
      {!overview.indexed ? (
        <p className="mb-4 text-sm">{t("overview.notIndexed")}</p>
      ) : overview.pages.length === 0 ? (
        <p className="mb-4 text-sm">{t("overview.noTasks")}</p>
      ) : pages.length === 0 ? (
        <p className="mb-4 text-sm">
          {t("overview.nothingWorked")}{" "}
          <button type="button" className="text-primary underline" onClick={() => setOnlyWorked(false)}>
            {t("overview.showAllPages")}
          </button>
        </p>
      ) : null}
      {pages.length > 0 && (
        // As wide as its columns, scrolling sideways when that is wider than the page.
        <div className="inline-block max-w-full overflow-x-auto rounded-md border align-top">
          <table className="w-max border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th rowSpan={2} scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                  {t("overview.student")}
                </th>
                <th rowSpan={2} scope="col" className="px-2 py-2 text-right font-medium">
                  {t("overview.done")}
                </th>
                {pages.map((page) => {
                  const isOpen = open.has(page.href);
                  return (
                    <th
                      key={page.href}
                      colSpan={isOpen ? page.elements.length : 1}
                      scope="colgroup"
                      className="border-l px-1 py-1 text-left align-bottom font-medium"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        title={[...(page.sections ?? []), page.title].join(" › ")}
                        onClick={() => toggle(page.href)}
                        className={cn(
                          "flex items-center gap-1 rounded px-1 text-left hover:bg-background",
                          !isOpen && "max-w-28",
                        )}
                      >
                        <span aria-hidden className="text-muted-foreground">
                          {isOpen ? "▾" : "▸"}
                        </span>
                        <span className={cn(!isOpen && "line-clamp-2")}>{page.title}</span>
                      </button>
                    </th>
                  );
                })}
                <th rowSpan={2} scope="col" className="border-l px-2 py-2 font-medium" title={t("overview.elsewhereHint")}>
                  {t("overview.elsewhere")}
                </th>
              </tr>
              <tr className="border-b bg-muted">
                {pages.flatMap((page) =>
                  open.has(page.href)
                    ? page.elements.map((e, i) => (
                        <th
                          key={`${page.href}/${cellOf(e)}`}
                          scope="col"
                          title={e.name}
                          className={cn("w-8 px-1 py-1 text-center font-normal text-muted-foreground", i === 0 && "border-l")}
                        >
                          {i + 1}
                        </th>
                      ))
                    : [
                        <th key={page.href} scope="col" className="border-l px-2 py-1 text-center font-normal text-muted-foreground">
                          {t("overview.tasks", { count: page.elements.length })}
                        </th>,
                      ],
                )}
              </tr>
            </thead>
            <tbody>
              {overview.students.map((s) => {
                const online = s.lastSeenAt !== null && now - s.lastSeenAt < ONLINE_MS;
                const done = pages.reduce((sum, p) => sum + p.elements.filter((e) => cellOf(e) in s.cells).length, 0);
                return (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-mono font-normal">
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
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {t("overview.doneOf", { done, total })}
                    </td>
                    {pages.flatMap((page) =>
                      open.has(page.href)
                        ? page.elements.map((e, i) => (
                            <TaskCell
                              key={`${page.href}/${cellOf(e)}`}
                              at={s.cells[cellOf(e)]}
                              first={i === 0}
                              label={(state) =>
                                t("overview.cellLabel", { username: s.username, page: page.title, n: i + 1, state })
                              }
                              stateOf={(at) => (at ? t("overview.changed", { when: ago(at) }) : t("overview.notYet"))}
                              onOpen={() => setPicked({ student: s, table: e.table, key: e.id, page: page.title, n: i + 1 })}
                            />
                          ))
                        : [
                            <PageCell
                              key={page.href}
                              page={page}
                              student={s}
                              label={(k, n) => t("overview.pageCellLabel", { username: s.username, page: page.title, done: k, total: n })}
                              lastLabel={(at) => t("overview.changed", { when: ago(at) })}
                              onOpen={() => toggle(page.href)}
                            />,
                          ],
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
      )}
      <AnswerDialog picked={picked} onClose={() => setPicked(null)} onViewAs={onViewAs} />
    </>
  );
}

/** One task of one student: filled when worked on, a click shows the answer. */
function TaskCell({
  at,
  first,
  label,
  stateOf,
  onOpen,
}: {
  at: number | undefined;
  first: boolean;
  label: (state: string) => string;
  stateOf: (at: number | undefined) => string;
  onOpen: () => void;
}) {
  const state = stateOf(at);
  return (
    <td className={cn("p-0 text-center", first && "border-l")}>
      {at ? (
        <button
          type="button"
          title={state}
          aria-label={label(state)}
          className="grid h-8 w-full place-items-center hover:bg-muted"
          onClick={onOpen}
        >
          <span className="size-3 rounded-full bg-primary" />
        </button>
      ) : (
        <span className="grid h-8 place-items-center" title={state} aria-label={label(state)} role="img">
          <span className="size-3 rounded-full border border-muted-foreground/30" />
        </span>
      )}
    </td>
  );
}

/** One page of one student: how many of its tasks they worked on, as a bar. */
function PageCell({
  page,
  student,
  label,
  lastLabel,
  onOpen,
}: {
  page: Page;
  student: OverviewStudent;
  label: (done: number, total: number) => string;
  lastLabel: (at: number) => string;
  onOpen: () => void;
}) {
  const times = page.elements.map((e) => student.cells[cellOf(e)]).filter((at): at is number => !!at);
  const n = page.elements.length;
  const k = times.length;
  const last = k > 0 ? Math.max(...times) : null;
  return (
    <td className="border-l p-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label(k, n)}
        title={last ? `${label(k, n)} · ${lastLabel(last)}` : label(k, n)}
        className="flex h-8 w-full min-w-16 items-center gap-1.5 px-2 hover:bg-muted"
      >
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${(k / n) * 100}%` }} />
        </span>
        <span className={cn("w-8 text-right text-xs tabular-nums", k === 0 && "text-muted-foreground/60")}>
          {k}/{n}
        </span>
      </button>
    </td>
  );
}

type ElementRow = { table: string; key: string; data: unknown; editedAt: number };

/**
 * One element's saved rows. Most elements have one; an embedded IDE has one
 * per file (key: element id + file name), shown under the file's name.
 */
function Answers({ id, rows }: { id: string; rows: ElementRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 1) return <Answer data={rows[0]!.data} />;
  // An embedded IDE's row under the bare id only lists its file names; the
  // files themselves follow, so the list is left out.
  const shown = rows.some((r) => r.key !== id && r.key.startsWith(id)) ? rows.filter((r) => r.key !== id) : rows;
  return (
    <div className="max-h-[60vh] space-y-4 overflow-auto">
      {shown.map((row) => {
        const label =
          row.key === id
            ? t("overview.fileList")
            : row.key.startsWith(id)
              ? row.key.slice(id.length).replace(/^-/, "")
              : t("overview.database");
        return (
          <div key={`${row.table}/${row.key}`}>
            <div className="mb-1 font-mono text-xs text-muted-foreground">{label}</div>
            <Answer data={row.data} />
          </div>
        );
      })}
    </div>
  );
}

/** The saved value, readable: a text answer, a script, files, or the raw data. */
function Answer({ data }: { data: unknown }) {
  const value = (data ?? {}) as Record<string, unknown>;
  if (typeof value.script === "string") {
    return <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{value.script}</pre>;
  }
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
    queryKey: ["students", picked?.student.id, "element", picked?.table, picked?.key],
    enabled: picked !== null,
    queryFn: () =>
      unwrap(
        api.students[":id"].element.$get({
          param: { id: String(picked!.student.id) },
          query: { table: picked!.table, id: picked!.key },
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
        {query.data && picked ? (
          <Answers id={picked.key} rows={query.data.rows} />
        ) : (
          <QueryState error={query.error} retry={query.refetch} />
        )}
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
