import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HandIcon, LoaderCircleIcon, RocketIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api";
import type { Book } from "@/lib/books";
import { useUser } from "@/lib/session";
import { CommitDiffDialog, type HistoryCommit, LiveDiffDialog } from "./editor/history-panel";

/*
 * What the book page and the editor share about publishing: the latest save
 * and what of it is not live yet (/head), the publish dialog that lists
 * those saves, an editor's request to publish, and "Check all pages".
 */

const fetchHead = (id: string) => unwrap(api.books[":id"].head.$get({ param: { id } }));
const fetchCheck = (id: string) => unwrap(api.books[":id"].check.$get({ param: { id } }));

export type Head = Awaited<ReturnType<typeof fetchHead>>;
export type CheckState = NonNullable<Awaited<ReturnType<typeof fetchCheck>>>;

export const headKey = (id: string) => ["books", id, "head"];
export const checkKey = (id: string) => ["books", id, "check"];

/**
 * The book's latest save. `commit` (the editor's current one) refetches it
 * when a save moves main on; the book page invalidates it instead.
 */
export function useHead(bookId: string, commit?: string | null) {
  return useQuery({
    queryKey: [...headKey(bookId), ...(commit === undefined ? [] : [commit])],
    queryFn: () => fetchHead(bookId),
  });
}

/** The book's page check, followed while it runs. */
export function useCheck(bookId: string) {
  return useQuery({
    queryKey: checkKey(bookId),
    queryFn: () => fetchCheck(bookId),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1000 : false),
  });
}

/** Everything that changes when something is published or asked for. */
export function invalidatePublishing(queryClient: ReturnType<typeof useQueryClient>, bookId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: headKey(bookId) }),
    queryClient.invalidateQueries({ queryKey: ["books", bookId, "builds"] }),
    queryClient.invalidateQueries({ queryKey: ["books", bookId, "versions"] }),
    queryClient.invalidateQueries({ queryKey: ["books", bookId, "history"] }),
    queryClient.invalidateQueries({ queryKey: ["books", bookId, "live-diff"] }),
    queryClient.invalidateQueries({ queryKey: ["books", bookId], exact: true }),
  ]);
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** The saves a publish makes live, each opening its diff. */
function Changes({ bookId, head }: { bookId: string; head: Head }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<HistoryCommit | null>(null);
  const [all, setAll] = useState(false);
  if (head.changes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("publishing.changes.none")}</p>;
  }
  const more = head.unpublished - head.changes.length;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{t("publishing.changes.title", { count: head.unpublished })}</p>
        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setAll(true)}>
          {t("publishing.changes.showAll")}
        </Button>
      </div>
      <ul className="max-h-60 overflow-y-auto rounded-md border" aria-label={t("publishing.changes.title", { count: head.unpublished })}>
        {head.changes.map((c) => (
          <li key={c.sha} className="border-b last:border-b-0">
            <button
              type="button"
              title={t("editor.history.showDiff")}
              onClick={() => setChosen(c)}
              className="block w-full px-3 py-1.5 text-left hover:bg-accent"
            >
              <span className="block truncate text-sm">{c.message}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("editor.history.by", { name: c.name, date: new Date(c.date).toLocaleString() })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="text-xs text-muted-foreground">{t("publishing.changes.more", { count: more })}</p>}
      <CommitDiffDialog bookId={bookId} commit={chosen} onClose={() => setChosen(null)} />
      <LiveDiffDialog bookId={bookId} open={all} commit={head.commit} onClose={() => setAll(false)} />
    </div>
  );
}

/** What the last page check says, as a line; with a button to run it. */
export function CheckLine({ book, head, compact = false }: { book: Book; head: Head | undefined; compact?: boolean }) {
  const { t } = useTranslation();
  const id = String(book.id);
  const queryClient = useQueryClient();
  const { data: check } = useCheck(id);
  const start = async () => {
    try {
      queryClient.setQueryData(checkKey(id), await unwrap(api.books[":id"].check.$post({ param: { id } })));
    } catch (error) {
      toast.error(errorMessage(error, t("common.somethingWrong")));
    }
  };
  // A check of an older save says nothing about the latest one.
  const current = !!check && !!head?.commit && check.commit === head.commit;
  let line: React.ReactNode = null;
  if (check?.status === "running") {
    line = <span>{t("publishing.check.running", { done: check.done, total: check.total })}</span>;
  } else if (check && current && check.status === "done") {
    line =
      check.problems.length === 0 ? (
        <span>{t("publishing.check.ok", { count: check.total })}</span>
      ) : (
        <span className="text-destructive">{t("publishing.check.problems", { count: check.problems.length })}</span>
      );
  } else if (check?.status === "changed") {
    line = <span>{t("publishing.check.changed")}</span>;
  } else if (check?.status === "failed") {
    line = <span className="text-destructive">{t("publishing.check.failed", { error: check.error ?? "" })}</span>;
  }
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {line}
        {check?.status !== "running" && (
          <Button size="sm" variant={compact ? "link" : "outline"} className={compact ? "h-auto p-0" : ""} disabled={!head?.commit} onClick={() => void start()}>
            {check && current ? t("publishing.check.again") : t("publishing.check.start")}
          </Button>
        )}
      </div>
      {current && check.status === "done" && check.problems.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border text-xs">
          {check.problems.map((p) => (
            <li key={p.file} className="border-b px-2 py-1 last:border-b-0">
              <span className="font-mono">{p.file}</span>
              <span className="block whitespace-pre-wrap text-destructive">{p.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Publishes the latest save, after showing what goes live. */
export function PublishDialog({
  book,
  open,
  onOpenChange,
  unsaved = false,
  onBuilding,
}: {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The editor has unsaved changes, which a publish leaves out. */
  unsaved?: boolean;
  /** The publish needs a build first; it goes live when that succeeds. */
  onBuilding?: (buildId: number) => void;
}) {
  const { t } = useTranslation();
  const id = String(book.id);
  const queryClient = useQueryClient();
  const { data: head } = useHead(id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      const result = await unwrap(api.books[":id"].publish.$post({ param: { id }, json: { note: note.trim() } }));
      toast.success(result.published ? t("publishing.publishedToast") : t("publishing.publishingToast"));
      if (!result.published) onBuilding?.(result.build.id);
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("common.somethingWrong")));
    } finally {
      setBusy(false);
      await invalidatePublishing(queryClient, id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("publishing.publishTitle")}</DialogTitle>
          <DialogDescription>{t("publishing.publishDescription")}</DialogDescription>
        </DialogHeader>
        {unsaved && <p className="text-sm text-destructive">{t("publishing.unsavedLeftOut")}</p>}
        {head && <Changes bookId={id} head={head} />}
        <CheckLine book={book} head={head} compact />
        <Input
          placeholder={t("publishing.notePlaceholder")}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={t("publishing.notePlaceholder")}
        />
        <DialogFooter>
          <Button disabled={busy} onClick={() => void publish()}>
            {t("publishing.publish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** An editor asks the owners to publish the latest save. */
export function RequestPublishDialog({
  book,
  open,
  onOpenChange,
  unsaved = false,
}: {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unsaved?: boolean;
}) {
  const { t } = useTranslation();
  const id = String(book.id);
  const queryClient = useQueryClient();
  const { data: head } = useHead(id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await unwrap(api.books[":id"]["publish-request"].$post({ param: { id }, json: { note: note.trim() } }));
      toast.success(t("publishing.request.sentToast"));
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("common.somethingWrong")));
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: headKey(id) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("publishing.request.title")}</DialogTitle>
          <DialogDescription>{t("publishing.request.description")}</DialogDescription>
        </DialogHeader>
        {unsaved && <p className="text-sm text-destructive">{t("publishing.unsavedLeftOut")}</p>}
        {head && <Changes bookId={id} head={head} />}
        <Textarea
          placeholder={t("publishing.request.notePlaceholder")}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={t("publishing.request.notePlaceholder")}
        />
        <DialogFooter>
          <Button disabled={busy} onClick={() => void send()}>
            {t("publishing.request.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** An open request to publish: who asked, when, why; owners and the asker may dismiss it. */
export function PublishRequestNotice({ book, request }: { book: Book; request: NonNullable<Head["request"]> }) {
  const { t } = useTranslation();
  const user = useUser();
  const id = String(book.id);
  const queryClient = useQueryClient();
  const mine = request.byId === user.id;
  const dismiss = async () => {
    try {
      await unwrap(api.books[":id"]["publish-request"].$delete({ param: { id } }));
    } catch (error) {
      toast.error(errorMessage(error, t("common.somethingWrong")));
    }
    await queryClient.invalidateQueries({ queryKey: headKey(id) });
  };
  return (
    <div className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm" role="status">
      <p>
        {mine
          ? t("publishing.request.youAsked", { when: new Date(request.at).toLocaleString() })
          : t("publishing.request.asked", {
              by: request.by ?? t("publishing.request.someone"),
              when: new Date(request.at).toLocaleString(),
            })}
      </p>
      {request.note && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{request.note}</p>}
      {(book.role === "owner" || mine) && (
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => void dismiss()}>
          {mine && book.role !== "owner" ? t("publishing.request.withdraw") : t("publishing.request.dismiss")}
        </Button>
      )}
    </div>
  );
}

/**
 * The editor's way to publish: owners publish the latest save, editors ask
 * the owners to. Shows how many saves are not live yet.
 */
export function EditorPublishButton({
  book,
  commit,
  unsaved,
}: {
  book: Book;
  /** The editor's current commit; a save refetches what is not live. */
  commit: string | null;
  unsaved: boolean;
}) {
  const { t } = useTranslation();
  const id = String(book.id);
  const { data: head } = useHead(id, commit);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  // A publish that builds first: followed here, since the editor has no
  // build list; when it ends the button catches up, and a failure is told.
  const [building, setBuilding] = useState<number | null>(null);
  useQuery({
    enabled: building !== null,
    queryKey: ["builds", building],
    queryFn: async () => {
      const build = await unwrap(api.builds[":id"].$get({ param: { id: String(building) } }));
      if (build.status !== "queued" && build.status !== "running") {
        setBuilding(null);
        if (build.status === "failed") {
          toast.error(t("publishing.failed.title"), { description: build.error ?? t("publishing.failed.hint") });
        }
        await invalidatePublishing(queryClient, id);
      }
      return build;
    },
    refetchInterval: 1500,
  });
  if (book.source !== "hosted" || !head) return null;
  const count = head.unpublished;
  const upToDate = !!book.publishedAt && count === 0;
  const owner = book.role === "owner";
  const label = owner ? t("editor.toolbar.publish") : head.request ? t("editor.toolbar.asked") : t("editor.toolbar.askToPublish");
  return (
    <>
      <Button
        size="sm"
        variant={owner ? "default" : "outline"}
        className="max-sm:gap-1 max-sm:px-2"
        disabled={upToDate || building !== null || (!owner && !!head.request)}
        title={upToDate ? t("publishing.isLive") : t("publishing.unpublishedChanges", { count })}
        onClick={() => setOpen(true)}
      >
        {building !== null ? (
          <LoaderCircleIcon className="size-3.5 animate-spin sm:hidden" aria-hidden />
        ) : owner ? (
          <RocketIcon className="size-3.5 sm:hidden" aria-hidden />
        ) : (
          <HandIcon className="size-3.5 sm:hidden" aria-hidden />
        )}
        <span className="max-sm:sr-only">{building !== null ? t("publishing.publishingNow") : label}</span>
        {count > 0 && building === null && (
          <span className="rounded-full bg-background/20 px-1.5 text-xs tabular-nums sm:ml-1" aria-hidden>
            {count}
          </span>
        )}
      </Button>
      {owner ? (
        <PublishDialog book={book} open={open} onOpenChange={setOpen} unsaved={unsaved} onBuilding={setBuilding} />
      ) : (
        <RequestPublishDialog book={book} open={open} onOpenChange={setOpen} unsaved={unsaved} />
      )}
    </>
  );
}
