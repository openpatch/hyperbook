import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon, HistoryIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiffView } from "./diff-view";

/*
 * The editor's History pane: the book's commits, newest first, paged from
 * the server (a book can have many), each with its author, message and line
 * counts. Clicking a commit opens its diff. A book's source is a git
 * repository, so this is what the editor's saves, uploads and pushes wrote.
 * The live commit is marked, so everything above it is not published yet.
 */

export type HistoryCommit = {
  sha: string;
  name: string;
  email: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  /** "published" on the live commit, v<N> on published versions. */
  tags?: string[];
};

type HistoryPage = { commits: HistoryCommit[]; next: string | null };

/** Saves further apart than this are separate entries of the History pane. */
export const RUN_GAP = 30 * 60_000;

/**
 * Commits (newest first) in runs: one person's saves, each within `gap` of
 * the next, shown as one entry — a writing session rather than a commit per
 * pause in typing. Only the pane groups them; the book's git history stays
 * as it is. A published commit (live, or a version) starts a run of its
 * own, so the pane can mark it.
 */
export function commitRuns(commits: HistoryCommit[], gap = RUN_GAP): HistoryCommit[][] {
  const runs: HistoryCommit[][] = [];
  for (const commit of commits) {
    const run = runs[runs.length - 1];
    const oldest = run?.[run.length - 1];
    if (
      run &&
      oldest &&
      oldest.email === commit.email &&
      Date.parse(oldest.date) - Date.parse(commit.date) <= gap &&
      !commit.tags?.length
    )
      run.push(commit);
    else runs.push([commit]);
  }
  return runs;
}

const fetchHistory = (bookId: string, after: string | null, path?: string) =>
  unwrap(
    api.books[":id"].history.$get({
      param: { id: bookId },
      query: { ...(after ? { after } : {}), ...(path ? { path } : {}) },
    }),
  ) as Promise<HistoryPage>;

export function HistoryPanel({
  bookId,
  activePath,
  commit,
}: {
  bookId: string;
  /** The open file; the "this file" scope filters the history by it. */
  activePath: string | null;
  /** The book's current commit; a save moves it, and the list follows. */
  commit: string | null;
}) {
  const { t } = useTranslation();
  // The whole history, or only the commits of the open file.
  const [scope, setScope] = useState<"book" | "file">("book");
  /** The entry whose changes are shown: one commit, or a run of them. */
  const [chosen, setChosen] = useState<HistoryCommit[] | null>(null);
  /** The runs unfolded into their single saves, by their newest commit. */
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const path = scope === "file" ? (activePath ?? undefined) : undefined;

  // Keyed by the current head commit: the workspace invalidates the listing
  // after a save, the head moves, and the first page is fetched anew. The
  // cursor pages below it start over, which is what a fresh history wants.
  const pages = useInfiniteQuery({
    queryKey: ["books", bookId, "history", path ?? null, commit],
    queryFn: ({ pageParam }) => fetchHistory(bookId, pageParam, path),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const commits = pages.data?.pages.flatMap((page) => page.commits) ?? [];
  const runs = commitRuns(commits);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <HistoryIcon className="size-4" />
        <span className="text-sm font-medium">{t("editor.history.title")}</span>
        <span className="flex-1" />
        <div
          role="group"
          aria-label={t("editor.history.scope")}
          className="flex overflow-hidden rounded-md border border-border"
        >
          {(["book", "file"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={option === "file" && !activePath}
              aria-pressed={scope === option}
              className={cn(
                "px-2 py-1 text-xs",
                scope === option
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:bg-accent",
                option === "file" && !activePath && "opacity-50",
              )}
              onClick={() => setScope(option)}
            >
              {t(
                option === "book"
                  ? "editor.history.book"
                  : "editor.history.file",
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The open file as saved against the live version: what publishing changes in it. */}
        {scope === "file" && activePath && (
          <div className="border-b border-border px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setComparing(true)}
            >
              {t("editor.history.compareLive")}
            </Button>
          </div>
        )}
        {runs.map((run) => {
          const head = run[0]!;
          if (run.length === 1)
            return <CommitRow key={head.sha} commits={run} onShow={setChosen} />;
          const open = unfolded.has(head.sha);
          return (
            <div key={head.sha}>
              <CommitRow
                commits={run}
                onShow={setChosen}
                open={open}
                onToggle={() =>
                  setUnfolded((prev) => {
                    const next = new Set(prev);
                    if (next.has(head.sha)) next.delete(head.sha);
                    else next.add(head.sha);
                    return next;
                  })
                }
              />
              {open &&
                run.map((c) => (
                  <CommitRow key={c.sha} commits={[c]} onShow={setChosen} nested />
                ))}
            </div>
          );
        })}
        {commits.length === 0 && !pages.isPending && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {scope === "file" && activePath
              ? t("editor.history.emptyFile")
              : t("editor.history.empty")}
          </p>
        )}
        {pages.hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="m-2"
            disabled={pages.isFetchingNextPage}
            onClick={() => void pages.fetchNextPage()}
          >
            {pages.isFetchingNextPage
              ? t("editor.history.loading")
              : t("editor.history.loadMore")}
          </Button>
        )}
      </div>

      <CommitDiffDialog
        bookId={bookId}
        commit={chosen?.[0] ?? null}
        run={chosen ?? undefined}
        path={path}
        onClose={() => setChosen(null)}
      />
      <LiveDiffDialog
        bookId={bookId}
        path={comparing ? (activePath ?? undefined) : undefined}
        open={comparing}
        commit={commit}
        onClose={() => setComparing(false)}
      />
    </div>
  );
}

/**
 * An entry of the History pane: one commit, or a run of one person's saves
 * (newest first), with the newest's message and the run's line counts. A
 * run unfolds into its single saves.
 */
function CommitRow({
  commits,
  onShow,
  open,
  onToggle,
  nested = false,
}: {
  commits: HistoryCommit[];
  onShow: (commits: HistoryCommit[]) => void;
  open?: boolean;
  onToggle?: () => void;
  nested?: boolean;
}) {
  const { t } = useTranslation();
  const c = commits[0]!;
  const oldest = commits[commits.length - 1]!;
  const additions = commits.reduce((sum, x) => sum + x.additions, 0);
  const deletions = commits.reduce((sum, x) => sum + x.deletions, 0);
  const when = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex border-b border-border", nested && "bg-muted/40")}>
      <button
        type="button"
        title={t("editor.history.showDiff")}
        onClick={() => onShow(commits)}
        className={cn(
          "block min-w-0 flex-1 py-2 pr-1 text-left hover:bg-accent",
          nested ? "pl-7" : "pl-3",
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {c.message}
          </span>
          {c.tags?.includes("published") && (
            <Badge className="shrink-0 px-1.5 py-0 text-[0.7rem]">
              {t("editor.history.live")}
            </Badge>
          )}
          {c.tags
            ?.filter((tag) => /^v\d+$/.test(tag))
            .map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="shrink-0 px-1.5 py-0 text-[0.7rem]"
              >
                {tag}
              </Badge>
            ))}
          <time
            dateTime={c.date}
            title={new Date(c.date).toLocaleString()}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {nested ? when(c.date) : new Date(c.date).toLocaleDateString()}
          </time>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            {commits.length > 1
              ? t("editor.history.run", {
                  name: c.name,
                  count: commits.length,
                  from: when(oldest.date),
                  to: when(c.date),
                })
              : c.name}
          </span>
          <span className="text-green-700 dark:text-green-400">
            +{additions}
          </span>
          <span className="text-red-700 dark:text-red-400">−{deletions}</span>
        </div>
      </button>
      {onToggle && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={t("editor.history.showSaves", { count: commits.length })}
          title={t("editor.history.showSaves", { count: commits.length })}
          onClick={onToggle}
          className="shrink-0 px-2 text-muted-foreground hover:bg-accent"
        >
          {open ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * The changes from the live version to the latest save: of one file (the
 * History pane's "Compare with live") or of the whole book (the publish
 * dialog). Unsaved text is not part of it; only saved changes get published.
 */
export function LiveDiffDialog({
  bookId,
  path,
  open,
  commit,
  onClose,
}: {
  bookId: string;
  /** One file of the book; none: the whole book. */
  path?: string;
  open: boolean;
  /** The latest save as the caller knows it; a new save fetches anew. */
  commit?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isPending } = useQuery({
    enabled: open,
    queryKey: ["books", bookId, "live-diff", path ?? null, commit ?? null],
    queryFn: () =>
      unwrap(
        api.books[":id"].history["live-diff"].$get({
          param: { id: bookId },
          query: path ? { path } : {},
        }),
      ),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85dvh] w-full sm:max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {path
              ? t("editor.history.liveDiffFile", { path })
              : t("editor.history.liveDiffBook")}
          </DialogTitle>
          <DialogDescription>
            {data && data.live === null
              ? t("editor.history.liveDiffNothingLive")
              : t("editor.history.liveDiffHint")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {isPending ? (
            <p className="p-2 text-sm text-muted-foreground">
              {t("editor.history.loadingDiff")}
            </p>
          ) : data && data.diff === "" ? (
            <p className="p-2 text-sm text-muted-foreground">
              {path
                ? t("editor.history.liveDiffSameFile")
                : t("editor.history.liveDiffSameBook")}
            </p>
          ) : (
            data && <DiffView diff={data.diff} />
          )}
          {data?.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("editor.history.truncated")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One commit's diff, fetched once: a commit never changes. */
export function CommitDiffDialog({
  bookId,
  commit,
  run,
  path,
  onClose,
}: {
  bookId: string;
  /** The commit, or the newest of `run`. */
  commit: HistoryCommit | null;
  /** Several commits in a row (newest first), shown as one change. */
  run?: HistoryCommit[];
  /** A run's changes to this file only. */
  path?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const oldest = run && run.length > 1 ? run[run.length - 1]! : null;
  const { data, isPending } = useQuery({
    enabled: commit !== null,
    queryKey: ["books", bookId, "history-diff", commit?.sha, oldest?.sha ?? null, oldest ? (path ?? null) : null],
    queryFn: () =>
      oldest
        ? unwrap(
            api.books[":id"].history["range-diff"].$get({
              param: { id: bookId },
              query: { oldest: oldest.sha, newest: commit!.sha, ...(path ? { path } : {}) },
            }),
          )
        : unwrap(
            api.books[":id"].history[":sha"].diff.$get({
              param: { id: bookId, sha: commit!.sha },
            }),
          ),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <Dialog open={commit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85dvh] w-full sm:max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {oldest
              ? t("editor.history.runTitle", { count: run!.length })
              : (commit?.message ?? "")}
          </DialogTitle>
          <DialogDescription>
            {commit &&
              (oldest
                ? t("editor.history.runBy", {
                    name: commit.name,
                    from: new Date(oldest.date).toLocaleString(),
                    to: new Date(commit.date).toLocaleString(),
                  })
                : t("editor.history.by", {
                    name: commit.name,
                    date: new Date(commit.date).toLocaleString(),
                  }))}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {isPending ? (
            <p className="p-2 text-sm text-muted-foreground">
              {t("editor.history.loadingDiff")}
            </p>
          ) : (
            data && <DiffView diff={data.diff} />
          )}
          {data?.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("editor.history.truncated")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
