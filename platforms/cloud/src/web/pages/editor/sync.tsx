import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { GitMergeIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
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
import { api, unwrap } from "@/lib/api";
import { rebaseComments } from "./comments";
import { threadsKey } from "./comments-panel";
import { DiffView } from "./diff-view";
import { type Listing, fetchListing, loadFile } from "./files";
import { type RemoteChange, type Workspace, isDirty } from "./workspace";

/*
 * Keeping the editor in step with the book while it is open. The server
 * tells the editor when main moves (an editor save elsewhere, a git push, a
 * zip upload) through GET /api/books/:id/events; the editor also checks when
 * its browser tab comes back into view. Then every open tab is compared
 * with the book:
 *
 * - a file without unsaved text follows the new version in place (cursor
 *   and scroll stay), or closes when it was deleted;
 * - a file with unsaved text keeps it and gets a bar above its editor (see
 *   RemoteChangeBar): auto-save leaves it alone until the teacher merges
 *   (MergeDialog), keeps theirs or keeps their own version.
 */

const filesKey = (bookId: string) => ["books", bookId, "files"];

/**
 * Replaces an editor's text with `text`, changing only the part between
 * the common start and end, so the cursor and scroll stay where they were
 * when the change is elsewhere. `undoable`: whether undo takes it back.
 */
export function replaceDoc(view: EditorView, text: string, undoable: boolean) {
  const old = view.state.doc.toString();
  if (old === text) return;
  let from = 0;
  const max = Math.min(old.length, text.length);
  while (from < max && old.charCodeAt(from) === text.charCodeAt(from)) from++;
  let oldEnd = old.length;
  let newEnd = text.length;
  while (oldEnd > from && newEnd > from && old.charCodeAt(oldEnd - 1) === text.charCodeAt(newEnd - 1)) {
    oldEnd--;
    newEnd--;
  }
  view.dispatch({
    changes: { from, to: oldEnd, insert: text.slice(from, newEnd) },
    annotations: undoable ? [] : [Transaction.addToHistory.of(false)],
  });
}

/** Conflict markers as `git merge-file` writes them: a start, a middle and an end line. */
export function hasConflictMarkers(text: string) {
  return /^<{7}(?: |$)/m.test(text) && /^={7}$/m.test(text) && /^>{7}(?: |$)/m.test(text);
}

export function useBookSync({
  bookId,
  ws,
  editorOf,
}: {
  bookId: string;
  ws: Workspace;
  /** The editor of a text file that can take new text in place; null for visual editors and the like. */
  editorOf: (path: string) => EditorView | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const wsRef = useRef(ws);
  wsRef.current = ws;
  const editorRef = useRef(editorOf);
  editorRef.current = editorOf;
  /** Who made a commit, as the events said; a check that finds it names them. */
  const authors = useRef(new Map<string, string | null>());
  const running = useRef(false);
  const again = useRef(false);

  /** Brings the open tabs in step with `next`. */
  const reconcile = useCallback(
    async (next: Listing) => {
      const by = (next.commit && authors.current.get(next.commit)) ?? null;
      const oids = new Map(next.files.map((f) => [f.path, f.oid]));
      const updated: string[] = [];
      const closed: string[] = [];
      for (const tab of wsRef.current.currentTabs()) {
        const current = wsRef.current;
        if (tab.status !== "ready" || !tab.loaded) continue;
        const oid = oids.get(tab.path) ?? null;
        const known = current.remoteOf(tab.path);
        if (oid === tab.loaded.oid) {
          // Theirs became what this tab is based on (saved over, merged).
          if (known) current.markRemote(tab.path, null);
          continue;
        }
        if (known && known.oid === oid) continue;
        if (isDirty(tab)) {
          current.markRemote(tab.path, { oid, by: by ?? known?.by ?? null });
          continue;
        }
        if (oid === null) {
          current.close(tab.path);
          closed.push(tab.path);
          continue;
        }
        const view = editorRef.current(tab.path);
        if (!view || tab.loaded.kind !== "text" || tab.loaded.encoding) {
          await current.reload(tab.path);
          updated.push(tab.path);
          continue;
        }
        const loaded = await loadFile(bookId, tab.path).catch(() => null);
        if (!loaded || loaded.kind !== "text" || loaded.encoding) {
          await current.reload(tab.path);
          updated.push(tab.path);
          continue;
        }
        // Typed into while the new version loaded: now it has unsaved text.
        const now = wsRef.current.currentTabs().find((t) => t.path === tab.path);
        if (!now || now.status !== "ready") continue;
        if (isDirty(now)) {
          wsRef.current.markRemote(tab.path, { oid: loaded.oid, by });
          continue;
        }
        wsRef.current.adopt(tab.path, { oid: loaded.oid, text: loaded.text }, loaded.text);
        const live = editorRef.current(tab.path);
        if (live) {
          replaceDoc(live, loaded.text, false);
          rebaseComments(live, loaded.oid);
        }
        updated.push(tab.path);
      }
      if (updated.length > 0) {
        void queryClient.invalidateQueries({ queryKey: threadsKey(bookId) });
        const files = updated.join(", ");
        toast.info(by ? t("editor.sync.updatedBy", { by, files }) : t("editor.sync.updatedUnknown", { files }));
      }
      if (closed.length > 0) toast.info(t("editor.sync.deletedClosed", { files: closed.join(", ") }));
    },
    [bookId, queryClient, t],
  );

  /** Fetches the book's files and brings the editor in step; one check at a time. */
  const check = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        // This editor's own commits answer with their listing; theirs to apply.
        while (wsRef.current.isBusy()) await new Promise((r) => setTimeout(r, 200));
        const next = await fetchListing(bookId);
        if (wsRef.current.isBusy()) {
          again.current = true;
          continue;
        }
        queryClient.setQueryData(filesKey(bookId), { commit: next.commit, files: next.files });
        await reconcile(next);
      } while (again.current);
    } catch {
      // Offline or signed out: the next event, or coming back, tries again.
    } finally {
      running.current = false;
    }
  }, [bookId, queryClient, reconcile]);

  useEffect(() => {
    const known = () => queryClient.getQueryData<Listing>(filesKey(bookId))?.commit ?? null;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`/api/books/${bookId}/events`);
    } catch {
      // No EventSource: coming back to the tab still checks.
    }
    source?.addEventListener("head", (event) => {
      const { commit } = JSON.parse((event as MessageEvent<string>).data) as { commit: string | null };
      // Also after a reconnect: what changed while the stream was gone.
      if (commit !== known()) void check();
    });
    source?.addEventListener("change", (event) => {
      const change = JSON.parse((event as MessageEvent<string>).data) as { commit: string; by: string | null };
      authors.current.set(change.commit, change.by);
      // This editor's own save: its listing is there already.
      if (change.commit !== known()) void check();
    });
    const back = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      source?.close();
      document.removeEventListener("visibilitychange", back);
    };
  }, [bookId, check, queryClient]);

  return { check };
}

/** Above an editor whose file someone else changed or deleted while it had unsaved text. */
export function RemoteChangeBar({
  change,
  mergeable,
  onMerge,
  onDrop,
  onKeep,
  onClose,
}: {
  change: RemoteChange;
  /** A text file in the code editor: merging works. */
  mergeable: boolean;
  onMerge: () => void;
  onDrop: () => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const deleted = change.oid === null;
  const message = deleted
    ? change.by
      ? t("editor.sync.deletedBy", { by: change.by })
      : t("editor.sync.deletedUnknown")
    : change.by
      ? t("editor.sync.changedBy", { by: change.by })
      : t("editor.sync.changedUnknown");
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-amber-500/10 px-3 py-2 text-sm"
    >
      <TriangleAlertIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="min-w-0 flex-1">
        {message} <span className="text-muted-foreground">{t("editor.sync.paused")}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {deleted ? (
          <>
            <Button size="sm" variant="outline" className="h-7" onClick={onClose}>
              {t("editor.sync.closeFile")}
            </Button>
            <Button size="sm" className="h-7" onClick={onKeep}>
              {t("editor.sync.saveMineAgain")}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" className="h-7" onClick={onDrop}>
              {t("editor.actions.dropMine")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              title={t("editor.sync.keepMineTitle")}
              onClick={onKeep}
            >
              {t("editor.sync.keepMine")}
            </Button>
            {mergeable && (
              <Button size="sm" className="h-7" onClick={onMerge}>
                <GitMergeIcon className="size-3.5" aria-hidden />
                {t("editor.sync.merge")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export type MergeRequest = { path: string; baseOid: string; text: string };

export type MergeResult = {
  path: string;
  /** The version merged with, which becomes the file's base. */
  oid: string;
  theirs: string;
  merged: string;
  conflicts: number;
};

/** What someone else changed, and both changes together, for the teacher to take or leave. */
export function MergeDialog({
  bookId,
  request,
  onApply,
  onClose,
}: {
  bookId: string;
  /** The file and its unsaved text; null hides the dialog. */
  request: MergeRequest | null;
  onApply: (result: MergeResult) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, error, isPending } = useQuery({
    queryKey: ["books", bookId, "merge", request],
    queryFn: () =>
      unwrap(
        api.books[":id"].files.merge.$post({
          param: { id: bookId },
          json: request!,
        }),
      ),
    enabled: request !== null,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  const by = data?.by?.name ?? null;
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85dvh] w-full flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("editor.sync.mergeTitle", { path: request?.path ?? "" })}</DialogTitle>
          <DialogDescription>
            {data && !data.deleted
              ? by
                ? t("editor.sync.theirChangesBy", { by })
                : t("editor.sync.theirChanges")
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {isPending ? (
            <p className="text-sm text-muted-foreground">{t("editor.sync.merging")}</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : data?.deleted ? (
            <p className="text-sm">{t("editor.sync.mergeDeleted")}</p>
          ) : data ? (
            data.diff === "" ? (
              <p className="text-sm text-muted-foreground">{t("editor.sync.noChanges")}</p>
            ) : (
              <DiffView diff={data.diff} />
            )
          ) : null}
        </div>
        {data && !data.deleted && (
          <p className={data.conflicts > 0 ? "text-sm text-amber-700 dark:text-amber-400" : "text-sm"}>
            {data.conflicts > 0
              ? t("editor.sync.mergeConflicts", { count: data.conflicts })
              : t("editor.sync.mergeClean")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!data || data.deleted}
            onClick={() =>
              data &&
              !data.deleted &&
              request &&
              onApply({
                path: request.path,
                oid: data.oid,
                theirs: data.theirs,
                merged: data.merged,
                conflicts: data.conflicts,
              })
            }
          >
            <GitMergeIcon className="size-4" aria-hidden />
            {t("editor.sync.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
