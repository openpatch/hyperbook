import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { item, openMenu, separator } from "./context-menu";
import type { FileEntry } from "./files";
import { highlight } from "./match-highlight";
import { rankMatches, type RankedMatch } from "./quick-open-fuzzy";

type TreeNode = { name: string; path: string; children: TreeNode[] | null };

/** Folders exist through their files; git keeps no empty folders. */
function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  // Folders by path, so a file finds its parent without scanning siblings.
  const folders = new Map<string, TreeNode>([["", root]]);
  const folderOf = (path: string): TreeNode => {
    let node = folders.get(path);
    if (!node) {
      const cut = path.lastIndexOf("/");
      const parent = folderOf(cut === -1 ? "" : path.slice(0, cut));
      node = { name: path.slice(cut + 1), path, children: [] };
      folders.set(path, node);
      parent.children!.push(node);
    }
    return node;
  };
  for (const file of files) {
    const cut = file.path.lastIndexOf("/");
    const parent = folderOf(cut === -1 ? "" : file.path.slice(0, cut));
    parent.children!.push({
      name: file.path.slice(cut + 1),
      path: file.path,
      children: null,
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      !!a.children === !!b.children
        ? a.name.localeCompare(b.name)
        : a.children
          ? -1
          : 1,
    );
    for (const n of nodes) if (n.children) sort(n.children);
  };
  sort(root.children!);
  return root.children!;
}

export type TreeActions = {
  open: (path: string) => void;
  newFile: (folder: string) => void;
  newFolder: (folder: string) => void;
  upload: (folder: string, files: File[]) => void;
  pickUpload: (folder: string) => void;
  rename: (path: string, isFolder: boolean) => void;
  remove: (path: string, isFolder: boolean) => void;
  download: (path: string) => void;
  /** Dragged onto a folder ("" is the book's root): move there. */
  move: (from: string, to: string, isFolder: boolean) => void;
  copy: (path: string, isFolder: boolean) => void;
  cut: (path: string, isFolder: boolean) => void;
  /** What was copied or cut, into a folder ("" is the book's root). */
  paste: (folder: string) => void;
};

/** What Copy or Cut in the tree picked; a cut one moves when pasted. */
export type TreeClipboard = { path: string; isFolder: boolean; cut: boolean };

/** What a dragged tree node carries; uploads from the system use "Files". */
const DRAG_TYPE = "application/x-hyperbook-path";

/** A node of the tree the context menu is about; null is the book's root. */
type MenuNode = { path: string; isFolder: boolean } | null;

/** A visible row of the tree: flattened, so rows memoize cheaply. */
type Row = { path: string; name: string; isFolder: boolean; depth: number };

/**
 * How a virtualized row is placed (see where the rows are rendered):
 * absolutely, translated by its `top` offset, measured by the virtualizer
 * through `measure` (which reads `index`). Three props instead of an object,
 * so the memoized rows skip unchanged ones.
 */
type PlaceProps = {
  top: number;
  index: number;
  measure: (element: HTMLElement | null) => void;
};

/** The height a row is assumed to have before it is measured. */
const ROW_HEIGHT = 28;

/**
 * The tree's rows, memoized on primitives only: a re-render — a toggle, a
 * drag, another file opened — touches the rows whose data changed, not all.
 * Placed by the virtualizer, so only the rows near the viewport exist.
 */
const TreeRow = memo(function TreeRow({
  path,
  name,
  isFolder,
  depth,
  open,
  isActive,
  isCut,
  isDirty,
  isDropTarget,
  top,
  index,
  measure,
  onToggle,
  onOpen,
  onMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  path: string;
  name: string;
  isFolder: boolean;
  depth: number;
  open: boolean;
  isActive: boolean;
  isCut: boolean;
  isDirty: boolean;
  isDropTarget: boolean;
} & PlaceProps & {
    onToggle: (path: string) => void;
    onOpen: (path: string) => void;
    onMenu: (event: React.MouseEvent, node: MenuNode) => void;
    onDragStart: (
      event: React.DragEvent,
      path: string,
      isFolder: boolean,
    ) => void;
    onDragOver: (event: React.DragEvent, folder: string) => void;
    onDragLeave: (event: React.DragEvent, folder: string) => void;
    onDrop: (event: React.DragEvent, folder: string) => void;
  }) {
  const { t } = useTranslation();
  return (
    <li
      ref={measure}
      data-index={index}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${top}px)`,
      }}
      {...(isFolder
        ? {
            onDragOver: (e: React.DragEvent) => onDragOver(e, path),
            onDragLeave: (e: React.DragEvent) => onDragLeave(e, path),
            onDrop: (e: React.DragEvent) => onDrop(e, path),
          }
        : {})}
    >
      <div
        draggable
        onDragStart={(e) => onDragStart(e, path, isFolder)}
        onContextMenu={(e) => onMenu(e, { path, isFolder })}
        className={cn(
          "group flex cursor-grab items-center rounded-md pr-1 text-sm hover:bg-accent",
          isActive && "bg-accent font-semibold text-primary",
          isCut && "opacity-50",
          isFolder && isDropTarget && "bg-secondary ring-2 ring-primary",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
          onClick={() => (isFolder ? onToggle(path) : onOpen(path))}
          aria-expanded={isFolder ? open : undefined}
        >
          {isFolder ? (
            <>
              {open ? (
                <ChevronDownIcon className="size-3.5 shrink-0" />
              ) : (
                <ChevronRightIcon className="size-3.5 shrink-0" />
              )}
              <FolderIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </>
          ) : (
            <FileIcon
              className="ml-4.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <span className="truncate">{name}</span>
          {isDirty && (
            <span
              className="ml-1 size-2 shrink-0 rounded-full bg-primary"
              title={t("editor.files.notSaved")}
            />
          )}
        </button>
      </div>
    </li>
  );
});

/** A file the filter matched, shown with its whole path; memoized as the rows. */
const FilterRow = memo(function FilterRow({
  path,
  positions,
  isActive,
  isCut,
  isDirty,
  top,
  index,
  measure,
  onOpen,
  onMenu,
}: {
  path: string;
  /** Where in `path` the filter query matched, for the highlight. */
  positions: number[];
  isActive: boolean;
  isCut: boolean;
  isDirty: boolean;
} & PlaceProps & {
    onOpen: (path: string) => void;
    onMenu: (event: React.MouseEvent, node: MenuNode) => void;
  }) {
  const { t } = useTranslation();
  return (
    <li
      ref={measure}
      data-index={index}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${top}px)`,
      }}
    >
      <div
        onContextMenu={(e) => onMenu(e, { path, isFolder: false })}
        className={cn(
          "group flex cursor-pointer items-center rounded-md pr-1 text-sm hover:bg-accent",
          isActive && "bg-accent font-semibold text-primary",
          isCut && "opacity-50",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 text-left"
          onClick={() => onOpen(path)}
        >
          <FileIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate font-mono">
            {highlight(path, positions)}
          </span>
          {isDirty && (
            <span
              className="ml-1 size-2 shrink-0 rounded-full bg-primary"
              title={t("editor.files.notSaved")}
            />
          )}
        </button>
      </div>
    </li>
  );
});

/** Only files whose path matches are shown, as a flat list. */
export const FileTree = memo(function FileTree({
  files,
  active,
  dirty,
  actions,
  clipboard,
  collapsed,
  setCollapsed,
  filter,
}: {
  files: FileEntry[];
  active: string | null;
  dirty: Set<string>;
  actions: TreeActions;
  clipboard: TreeClipboard | null;
  /** Which folders are collapsed; owned by the sidebar, for its header buttons. */
  collapsed: Set<string>;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>;
  filter: string;
}) {
  const { t } = useTranslation();
  const tree = useMemo(() => buildTree(files), [files]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // The tree's scrollable area, which the virtualizer fills with rows.
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typing stays urgent while the big list follows: it renders from the
  // deferred filter, so a keystroke never waits for thousands of matches.
  const deferredFilter = useDeferredValue(filter);

  const toggle = useCallback(
    (path: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      }),
    [setCollapsed],
  );

  // A file opened elsewhere (quick open, "Edit visually") unfolds its folders.
  useEffect(() => {
    if (!active || !active.includes("/")) return;
    setCollapsed((prev) => {
      const folders: string[] = [];
      let cut = -1;
      while ((cut = active.indexOf("/", cut + 1)) !== -1)
        folders.push(active.slice(0, cut));
      if (!folders.some((folder) => prev.has(folder))) return prev;
      const next = new Set(prev);
      for (const folder of folders) next.delete(folder);
      return next;
    });
  }, [active, setCollapsed]);

  /**
   * The tree's context menu, in the looks of the editor's: for a file or a
   * folder, or (node null) for the empty space below them, the book's root.
   * Paste and the new files go into the folder, or next to the file.
   */
  const showMenu = useCallback(
    (event: React.MouseEvent, node: MenuNode) => {
      event.preventDefault();
      event.stopPropagation();
      const folder =
        node === null
          ? ""
          : node.isFolder
            ? node.path
            : node.path.slice(0, Math.max(0, node.path.lastIndexOf("/")));
      openMenu(event.clientX, event.clientY, (box) => {
        if (node === null || node.isFolder) {
          item(box, t("editor.files.newFile"), () => actions.newFile(folder));
          item(box, t("editor.files.newFolder"), () =>
            actions.newFolder(folder),
          );
          item(box, t("editor.files.uploadFiles"), () =>
            actions.pickUpload(folder),
          );
          separator(box);
        }
        if (node && !node.isFolder) {
          item(box, t("editor.files.download"), () =>
            actions.download(node.path),
          );
          separator(box);
        }
        if (node) {
          item(box, t("editor.files.cut"), () =>
            actions.cut(node.path, node.isFolder),
          );
          item(box, t("editor.files.copy"), () =>
            actions.copy(node.path, node.isFolder),
          );
        }
        item(box, t("editor.files.paste"), () => actions.paste(folder), {
          disabled: clipboard === null,
        });
        if (node) {
          separator(box);
          item(box, t("editor.files.rename"), () =>
            actions.rename(node.path, node.isFolder),
          );
          item(
            box,
            t("editor.files.delete"),
            () => actions.remove(node.path, node.isFolder),
            { destructive: true },
          );
        }
      });
    },
    [t, actions, clipboard],
  );

  const dragStart = useCallback(
    (event: React.DragEvent, path: string, isFolder: boolean) => {
      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ path, isFolder }));
      event.dataTransfer.setData("text/plain", path);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const dragOver = useCallback((event: React.DragEvent, folder: string) => {
    const upload = event.dataTransfer.types.includes("Files");
    if (!upload && !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = upload ? "copy" : "move";
    setDropTarget(folder);
  }, []);

  const dragLeave = useCallback((event: React.DragEvent, folder: string) => {
    event.stopPropagation();
    setDropTarget((t) => (t === folder ? null : t));
  }, []);

  const drop = useCallback(
    (event: React.DragEvent, folder: string) => {
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(null);
      const dropped = [...event.dataTransfer.files];
      if (dropped.length > 0) {
        actions.upload(folder, dropped);
        return;
      }
      // A file or folder of the book, dragged to its new folder.
      const payload = event.dataTransfer.getData(DRAG_TYPE);
      if (!payload) return;
      const { path, isFolder } = JSON.parse(payload) as {
        path: string;
        isFolder: boolean;
      };
      actions.move(path, folder, isFolder);
    },
    [actions],
  );

  /** Cut and not pasted yet: shown faded, like file managers do. */
  const isCut = useCallback(
    (path: string) =>
      clipboard?.cut === true &&
      (path === clipboard.path || path.startsWith(clipboard.path + "/")),
    [clipboard],
  );

  // The open folders' rows, flattened: indentation by depth, not by nesting.
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        out.push({
          path: node.path,
          name: node.name,
          isFolder: node.children !== null,
          depth,
        });
        if (node.children && !collapsed.has(node.path))
          walk(node.children, depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  }, [tree, collapsed]);

  // While filtering, the tree turns into the matching files, with their
  // paths — found and ranked the way quick open does it (see
  // quick-open-fuzzy.ts), with the matched characters highlighted.
  const needle = deferredFilter.trim().toLowerCase();
  const matching = useMemo(
    () =>
      needle
        ? rankMatches(
            needle,
            files.map((f) => f.path),
          )
        : null,
    [files, needle],
  );
  const list: (Row | FileEntry | RankedMatch)[] = matching ?? rows;

  // Only the rows near the viewport are in the DOM, however big the book is.
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // The rows start below the scroll area's top padding.
    scrollMargin: 4,
    overscan: 10,
  });
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-1">
      <div
        className={cn("min-h-full pb-8", dropTarget === "" && "bg-secondary")}
        onDragOver={(e) => dragOver(e, "")}
        onDragLeave={(e) => dragLeave(e, "")}
        onDrop={(e) => drop(e, "")}
        onContextMenu={(e) => showMenu(e, null)}
      >
        <ul
          aria-label={t("editor.files.title")}
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = list[item.index]!;
            return matching ? (
              <FilterRow
                key={row.path}
                path={row.path}
                positions={(row as RankedMatch).positions}
                isActive={row.path === active}
                isCut={isCut(row.path)}
                isDirty={dirty.has(row.path)}
                top={item.start}
                index={item.index}
                measure={virtualizer.measureElement}
                onOpen={actions.open}
                onMenu={showMenu}
              />
            ) : (
              <TreeRow
                key={row.path}
                path={row.path}
                name={(row as Row).name}
                isFolder={(row as Row).isFolder}
                depth={(row as Row).depth}
                open={(row as Row).isFolder && !collapsed.has(row.path)}
                isActive={row.path === active}
                isCut={isCut(row.path)}
                isDirty={dirty.has(row.path)}
                isDropTarget={dropTarget === row.path}
                top={item.start}
                index={item.index}
                measure={virtualizer.measureElement}
                onToggle={toggle}
                onOpen={actions.open}
                onMenu={showMenu}
                onDragStart={dragStart}
                onDragOver={dragOver}
                onDragLeave={dragLeave}
                onDrop={drop}
              />
            );
          })}
          {matching && matching.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("editor.files.noMatches")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});
