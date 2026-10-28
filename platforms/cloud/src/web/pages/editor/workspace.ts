import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FileChange } from "../../../shared/schemas";
import { ApiError } from "@/lib/api";
import { type Listing, type Loaded, commitFiles, loadFile } from "./files";

/** An open file. `version` changes when the file is loaded again, which remounts its editor. */
export type Tab = {
  path: string;
  version: number;
  status: "loading" | "ready" | "error";
  error?: string;
  loaded?: Loaded;
  /** Current text of a text file. */
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
 * The editor's state: the book's files, the open tabs and their unsaved
 * text. Every save is one commit; the server answers with the new listing.
 */
export function useWorkspace(bookId: string, listing: Listing) {
  const queryClient = useQueryClient();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const patchTab = useCallback((path: string, patch: Partial<Tab> | ((tab: Tab) => Partial<Tab>)) => {
    setTabs((all) => all.map((t) => (t.path === path ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  const load = useCallback(
    async (path: string) => {
      try {
        const loaded = await loadFile(bookId, path);
        patchTab(path, (t) => ({
          status: "ready",
          loaded,
          text: loaded.kind === "text" ? loaded.text : undefined,
          version: t.version + 1,
        }));
      } catch (error) {
        patchTab(path, { status: "error", error: (error as Error).message });
      }
    },
    [bookId, patchTab],
  );

  const open = useCallback(
    (path: string) => {
      setActive(path);
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
    (path: string) => {
      patchTab(path, { status: "loading" });
      return load(path);
    },
    [load, patchTab],
  );

  const close = useCallback((path: string) => {
    setTabs((all) => {
      const i = all.findIndex((t) => t.path === path);
      const next = all.filter((t) => t.path !== path);
      setActive((a) => (a === path ? (next[Math.min(i, next.length - 1)]?.path ?? null) : a));
      return next;
    });
  }, []);

  const setText = useCallback(
    (path: string, text: string) => {
      // Right away, so a save that follows before the next render (a visual
      // editor's own save button) saves this text.
      tabsRef.current = tabsRef.current.map((t) => (t.path === path ? { ...t, text } : t));
      patchTab(path, { text });
    },
    [patchTab],
  );

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
      const toSave = tabsRef.current.filter((t) => paths.includes(t.path) && isDirty(t));
      if (toSave.length === 0) return;
      const res = await commit(
        toSave.map((t) => ({
          op: "write" as const,
          path: t.path,
          content: t.text!,
          baseOid: t.path in baseOids ? baseOids[t.path]! : t.loaded!.oid,
        })),
      );
      const oids = new Map(res.files.map((f) => [f.path, f.oid]));
      setTabs((all) =>
        all.map((t) => {
          const saved = toSave.find((s) => s.path === t.path);
          if (!saved || t.loaded?.kind !== "text") return t;
          // What was saved becomes the base; typing since then stays unsaved.
          return { ...t, loaded: { ...t.loaded, oid: oids.get(t.path)!, text: saved.text! } };
        }),
      );
    },
    [commit],
  );

  /** After a move, open tabs follow their files. */
  const renameTabs = useCallback((moves: Map<string, string>) => {
    setTabs((all) => all.map((t) => (moves.has(t.path) ? { ...t, path: moves.get(t.path)! } : t)));
    setActive((a) => (a && moves.has(a) ? moves.get(a)! : a));
  }, []);

  const dirty = useMemo(() => new Set(tabs.filter(isDirty).map((t) => t.path)), [tabs]);
  const oidOf = useCallback((path: string) => listing.files.find((f) => f.path === path)?.oid ?? null, [listing]);

  return {
    tabs,
    /** The tabs including changes not rendered yet. */
    currentTabs: () => tabsRef.current,
    active,
    setActive,
    open,
    reload,
    close,
    setText,
    save,
    commit,
    renameTabs,
    dirty,
    oidOf,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
