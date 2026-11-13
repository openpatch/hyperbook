import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FileChange } from "../../../shared/schemas";
import { ApiError } from "@/lib/api";
import { MAX_DRAFT_LENGTH, deleteDraft, draftPaths, getDraft, putDraft } from "./drafts";
import { type Listing, type Loaded, commitFiles, loadFile } from "./files";
import { loadTabs, saveTabs } from "./session";

/** An open file. `version` changes when the file is loaded again, which remounts its editor. */
export type Tab = {
  path: string;
  version: number;
  status: "loading" | "ready" | "error";
  error?: string;
  loaded?: Loaded;
  /**
   * Text of a text file, as of the last render: typing does not render the
   * editor, so this lags until the file turns saved or unsaved. The current
   * text is `textOf(path)`, or `useLiveText` to follow it.
   */
  text?: string;
};

export const isDirty = (tab: Tab) =>
  tab.status === "ready" && tab.loaded?.kind === "text" && tab.text !== tab.loaded.text;

/** Thrown by save() when files were changed by someone else in the meantime. */
export class ConflictError extends Error {
  constructor(readonly paths: string[]) {
    super("Changed by someone else in the meantime");
    this.name = "ConflictError";
  }
}

/**
 * The current text of each open file, outside React state: a keystroke would
 * otherwise render the whole editor (file tree, tabs, dialogs, preview).
 * Only what shows the text follows it, through `useLiveText`.
 */
class LiveTexts {
  private texts = new Map<string, string>();
  private listeners = new Map<string, Set<() => void>>();

  get(path: string) {
    return this.texts.get(path);
  }

  set(path: string, text: string) {
    this.texts.set(path, text);
    for (const listener of this.listeners.get(path) ?? []) listener();
  }

  delete(path: string) {
    this.texts.delete(path);
  }

  subscribe(path: string, listener: () => void) {
    const set = this.listeners.get(path) ?? new Set();
    this.listeners.set(path, set.add(listener));
    return () => void set.delete(listener);
  }
}

/** The current text of `path` (undefined while it is not loaded), following every change. */
export function useLiveText(ws: Workspace, path: string | null): string | undefined {
  return useSyncExternalStore(
    useCallback((listener) => (path === null ? () => {} : ws.subscribeText(path, listener)), [ws.subscribeText, path]),
    () => (path === null ? undefined : ws.textOf(path)),
  );
}

/**
 * The editor's state: the book's files, the open tabs and their unsaved
 * text. Every save is one commit; the server answers with the new listing.
 */
export function useWorkspace(
  bookId: string,
  listing: Listing,
  {
    onRestored,
  }: {
    /**
     * A file opened with unsaved text from a draft (see drafts.ts); `stale`
     * when the file was saved by someone since, so saving asks first.
     */
    onRestored?: (path: string, stale: boolean) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const live = useRef(new LiveTexts()).current;
  /** The tabs with their current text. */
  const currentTabs = useCallback(
    () => tabsRef.current.map((t) => (live.get(t.path) === undefined ? t : { ...t, text: live.get(t.path) })),
    [live],
  );

  const restored = useRef(onRestored);
  restored.current = onRestored;

  // Drafts are written a moment after typing stops, not on every key.
  const draftTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>()).current;
  /** Keeps the file's unsaved text as a draft, or drops the draft when it is saved. */
  const keepDraft = useCallback(
    (path: string, delay = 500) => {
      clearTimeout(draftTimers.get(path));
      draftTimers.set(
        path,
        setTimeout(() => {
          draftTimers.delete(path);
          const tab = tabsRef.current.find((t) => t.path === path);
          const text = live.get(path);
          if (
            !tab ||
            tab.loaded?.kind !== "text" ||
            tab.loaded.encoding ||
            text === undefined ||
            text === tab.loaded.text ||
            text.length > MAX_DRAFT_LENGTH
          )
            return void deleteDraft(bookId, path);
          void putDraft(bookId, path, { text, baseOid: tab.loaded.oid, savedAt: Date.now() });
        }, delay),
      );
    },
    [bookId, draftTimers, live],
  );
  const dropDraft = useCallback(
    (path: string) => {
      clearTimeout(draftTimers.get(path));
      draftTimers.delete(path);
      return deleteDraft(bookId, path);
    },
    [bookId, draftTimers],
  );

  const patchTab = useCallback((path: string, patch: Partial<Tab> | ((tab: Tab) => Partial<Tab>)) => {
    setTabs((all) => all.map((t) => (t.path === path ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  const load = useCallback(
    async (path: string) => {
      try {
        let loaded = await loadFile(bookId, path);
        let text = loaded.kind === "text" ? loaded.text : undefined;
        // Unsaved text from before (a closed tab, a crash) comes back. Typed
        // on an older version, it keeps that version as its base, so saving
        // it meets the newer one as a conflict instead of overwriting it.
        if (loaded.kind === "text" && !loaded.encoding) {
          const draft = await getDraft(bookId, path);
          if (draft && draft.text !== loaded.text) {
            const stale = draft.baseOid !== loaded.oid;
            text = draft.text;
            if (stale) loaded = { ...loaded, oid: draft.baseOid };
            restored.current?.(path, stale);
          } else if (draft) void deleteDraft(bookId, path);
        }
        if (text !== undefined) live.set(path, text);
        else live.delete(path);
        const final = loaded;
        patchTab(path, (t) => ({
          status: "ready",
          loaded: final,
          text,
          version: t.version + 1,
        }));
      } catch (error) {
        patchTab(path, { status: "error", error: (error as Error).message });
      }
    },
    [bookId, live, patchTab],
  );

  /**
   * Opens `path` in a tab and shows it; `{ show: false }` only shows it when
   * no tab is shown yet (a draft brought back next to the remembered tabs).
   */
  const open = useCallback(
    (path: string, { show = true }: { show?: boolean } = {}) => {
      if (show) setActive(path);
      else setActive((a) => a ?? path);
      if (tabsRef.current.some((t) => t.path === path)) return;
      const tab: Tab = { path, version: 0, status: "loading" };
      // Right away, so a second call before the next render sees it.
      tabsRef.current = [...tabsRef.current, tab];
      setTabs((all) => (all.some((t) => t.path === path) ? all : [...all, tab]));
      void load(path);
    },
    [load],
  );

  /** Loads a file again from the server, dropping unsaved changes. */
  const reload = useCallback(
    async (path: string) => {
      patchTab(path, { status: "loading" });
      await dropDraft(path);
      return load(path);
    },
    [dropDraft, load, patchTab],
  );

  /** Opens the files that have drafts, so their unsaved text is back; resolves to them. */
  const restoreDrafts = useCallback(async () => {
    const existing = new Set(listing.files.map((f) => f.path));
    const paths = await draftPaths(bookId);
    for (const path of paths) {
      if (existing.has(path)) open(path, { show: false });
      // The file is gone (deleted or moved elsewhere): its draft has no place.
      else void deleteDraft(bookId, path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, open]);

  /**
   * Opens the tabs of last time (see session.ts) that still exist, showing
   * the one shown then; false when there are none, so the start page opens.
   * From then on the tabs are remembered.
   */
  const remembering = useRef(false);
  const restoreTabs = useCallback(() => {
    remembering.current = true;
    const kept = loadTabs(bookId);
    const existing = new Set(listing.files.map((f) => f.path));
    const paths = kept?.paths.filter((p) => existing.has(p)) ?? [];
    for (const path of paths) open(path, { show: false });
    if (kept?.active && paths.includes(kept.active)) setActive(kept.active);
    return paths.length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, open]);
  useEffect(() => {
    if (remembering.current) saveTabs(bookId, { paths: tabs.map((t) => t.path), active });
  }, [bookId, tabs, active]);

  /** Drops every draft of the open files: their unsaved text was given up. */
  const discardDrafts = useCallback(
    () => Promise.all(tabsRef.current.map((t) => dropDraft(t.path))),
    [dropDraft],
  );

  /** Closes a tab; its unsaved text, if any, is dropped. */
  const close = useCallback((path: string) => {
    void dropDraft(path);
    live.delete(path);
    setTabs((all) => {
      const i = all.findIndex((t) => t.path === path);
      const next = all.filter((t) => t.path !== path);
      setActive((a) => (a === path ? (next[Math.min(i, next.length - 1)]?.path ?? null) : a));
      return next;
    });
  }, [dropDraft, live]);

  const setText = useCallback(
    (path: string, text: string) => {
      const tab = tabsRef.current.find((t) => t.path === path);
      const wasDirty = tab !== undefined && isDirty({ ...tab, text: live.get(path) ?? tab.text });
      // Right away, so a save that follows before the next render (a visual
      // editor's own save button) saves this text.
      live.set(path, text);
      // React only hears of it when the file turns unsaved, or saved again.
      if (tab && isDirty({ ...tab, text }) !== wasDirty) patchTab(path, { text });
      keepDraft(path);
    },
    [keepDraft, live, patchTab],
  );

  const textOf = useCallback(
    (path: string) => live.get(path) ?? tabsRef.current.find((t) => t.path === path)?.text,
    [live],
  );
  const subscribeText = useCallback((path: string, listener: () => void) => live.subscribe(path, listener), [live]);

  const applyListing = useCallback(
    (next: Listing) => {
      queryClient.setQueryData(["books", bookId, "files"], { commit: next.commit, files: next.files });
    },
    [bookId, queryClient],
  );

  /** Commits `changes`; on a conflict throws ConflictError with the paths. */
  const commit = useCallback(
    async (changes: FileChange[], message?: string) => {
      try {
        const res = await commitFiles(bookId, changes, message);
        applyListing(res);
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && Array.isArray(error.body.conflicts)) {
          // The listing is outdated, too.
          await queryClient.invalidateQueries({ queryKey: ["books", bookId, "files"] });
          throw new ConflictError(error.body.conflicts as string[]);
        }
        throw error;
      }
    },
    [applyListing, bookId, queryClient],
  );

  /**
   * Saves the given open text files in one commit. `baseOids` overrides the
   * base of a file (to overwrite someone else's version).
   */
  const save = useCallback(
    async (paths: string[], baseOids: Record<string, string | null> = {}) => {
      const toSave = currentTabs().filter((t) => paths.includes(t.path) && isDirty(t));
      if (toSave.length === 0) return null;
      const res = await commit(
        toSave.map((t) => ({
          op: "write" as const,
          path: t.path,
          content: t.text!,
          // A binary element file (a .sb3) travels as base64 text.
          ...(t.loaded?.kind === "text" && t.loaded.encoding ? { encoding: t.loaded.encoding } : {}),
          baseOid: t.path in baseOids ? baseOids[t.path]! : t.loaded!.oid,
        })),
      );
      const oids = new Map(res.files.map((f) => [f.path, f.oid]));
      setTabs((all) =>
        all.map((t) => {
          const saved = toSave.find((s) => s.path === t.path);
          if (!saved || t.loaded?.kind !== "text") return t;
          // What was saved becomes the base; typing since then stays unsaved.
          return { ...t, text: live.get(t.path) ?? t.text, loaded: { ...t.loaded, oid: oids.get(t.path)!, text: saved.text! } };
        }),
      );
      // Saved: the draft goes, or follows what was typed since.
      for (const t of toSave) keepDraft(t.path, 0);
      /** What was saved, as the blob it became. */
      return { saved: toSave.map((t) => ({ path: t.path, oid: oids.get(t.path)! })) };
    },
    [commit, currentTabs, keepDraft, live],
  );

  /** After a move, open tabs follow their files. */
  const renameTabs = useCallback((moves: Map<string, string>) => {
    for (const [from, to] of moves) {
      const text = live.get(from);
      if (text === undefined) continue;
      live.delete(from);
      live.set(to, text);
      void dropDraft(from);
    }
    setTabs((all) => all.map((t) => (moves.has(t.path) ? { ...t, path: moves.get(t.path)! } : t)));
    setActive((a) => (a && moves.has(a) ? moves.get(a)! : a));
  }, [dropDraft, live]);

  const dirty = useMemo(() => new Set(tabs.filter(isDirty).map((t) => t.path)), [tabs]);
  const oidOf = useCallback((path: string) => listing.files.find((f) => f.path === path)?.oid ?? null, [listing]);
  const dirtyOf = useCallback(
    (path: string) => {
      const tab = currentTabs().find((candidate) => candidate.path === path);
      return tab ? isDirty(tab) : false;
    },
    [currentTabs],
  );

  return {
    tabs,
    /** The tabs with their current text. */
    currentTabs,
    textOf,
    subscribeText,
    active,
    setActive,
    open,
    reload,
    restoreDrafts,
    restoreTabs,
    discardDrafts,
    close,
    setText,
    save,
    commit,
    renameTabs,
    dirty,
    dirtyOf,
    oidOf,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
