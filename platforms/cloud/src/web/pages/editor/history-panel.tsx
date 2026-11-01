import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
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
 */

export type HistoryCommit = {
  sha: string;
  name: string;
  email: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
};

type HistoryPage = { commits: HistoryCommit[]; next: string | null };

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
  const [chosen, setChosen] = useState<HistoryCommit | null>(null);
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
        {commits.map((c) => (
          <button
            key={c.sha}
            type="button"
            title={t("editor.history.showDiff")}
            onClick={() => setChosen(c)}
            className="block w-full border-b border-border px-3 py-2 text-left hover:bg-accent"
          >
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {c.message}
              </span>
              <time
                dateTime={c.date}
                title={new Date(c.date).toLocaleString()}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {new Date(c.date).toLocaleDateString()}
              </time>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="text-green-600 dark:text-green-400">
                +{c.additions}
              </span>
              <span className="text-red-600 dark:text-red-400">
                −{c.deletions}
              </span>
            </div>
          </button>
        ))}
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
        commit={chosen}
        onClose={() => setChosen(null)}
      />
    </div>
  );
}

/** One commit's diff, fetched once: a commit never changes. */
function CommitDiffDialog({
  bookId,
  commit,
  onClose,
}: {
  bookId: string;
  commit: HistoryCommit | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isPending } = useQuery({
    enabled: commit !== null,
    queryKey: ["books", bookId, "history-diff", commit?.sha],
    queryFn: () =>
      unwrap(
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
            {commit?.message ?? ""}
          </DialogTitle>
          <DialogDescription>
            {commit &&
              t("editor.history.by", {
                name: commit.name,
                date: new Date(commit.date).toLocaleString(),
              })}
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
