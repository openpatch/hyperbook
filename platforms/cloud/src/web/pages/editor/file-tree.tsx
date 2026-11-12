import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FileIcon,
  FolderIcon,
  MessageSquareIcon,
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
import { bookPathProblem } from "../../../shared/schemas";
import { cn } from "@/lib/utils";
import { fromKeyboard, item, menuPoint, openMenu, separator } from "./context-menu";
import type { FileEntry } from "./files";
import { highlight } from "./match-highlight";
import { rankMatches, type RankedMatch } from "./quick-open-fuzzy";

type TreeNode = { name: string; path: string; children: TreeNode[] | null };

export const parentOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const join = (folder: string, name: string) =>
  folder ? `${folder}/${name}` : name;

/**
 * A name being typed into the tree, in place: a new file or folder in
 * `folder` ("" is the book's root), or a new name for `path`.
 */
export type TreeEdit =
  | { kind: "file" | "folder"; folder: string }
  | { kind: "rename"; path: string; isFolder: boolean };

/** The folder an edit's name lands in. */
export const editFolder = (edit: TreeEdit) =>
  edit.kind === "rename" ? parentOf(edit.path) : edit.folder;

/**
 * The path a typed name makes. A new file may name subfolders ("a/b.md");
 * a page in book/ or glossary/ typed without an extension gets ".md".
 */
export function editTarget(edit: TreeEdit, typed: string): string {
  const name = typed.trim();
  const path = join(editFolder(edit), name);
  if (
    edit.kind === "file" &&
    /^(book|glossary)\//.test(path) &&
    !name.split("/").pop()!.includes(".")
  )
    return `${path}.md`;
  return path;
}

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
  /** Creates a file, or a folder with its index.md; a thrown error is shown at the name. */
  create: (path: string, isFolder: boolean) => Promise<void>;
  upload: (folder: string, files: File[]) => void;
  pickUpload: (folder: string) => void;
  /** Whether `path` may be renamed now (no unsaved changes in it); says why not. */
  canRename: (path: string, isFolder: boolean) => boolean;
  rename: (from: string, to: string, isFolder: boolean) => void;
  /** Deletes files and folders; none is inside another. */
  remove: (nodes: NodeRef[]) => void;
  download: (path: string) => void;
  /** Dragged onto a folder ("" is the book's root): move there. */
  move: (nodes: NodeRef[], to: string) => void;
  copy: (nodes: NodeRef[]) => void;
  cut: (nodes: NodeRef[]) => void;
  /** What was copied or cut, into a folder ("" is the book's root). */
  paste: (folder: string) => void;
};

/** A file or folder of the book. */
export type NodeRef = { path: string; isFolder: boolean };

/** What Copy or Cut in the tree picked; cut ones move when pasted. */
export type TreeClipboard = { nodes: NodeRef[]; cut: boolean };

/** Drops what lies in a folder that is there too: the folder carries it. */
export function outermost(nodes: NodeRef[]): NodeRef[] {
  const folders = nodes.filter((n) => n.isFolder).map((n) => n.path);
  return nodes.filter(
    (n, i) =>
      !folders.some((f) => n.path.startsWith(f + "/")) &&
      nodes.findIndex((m) => m.path === n.path) === i,
  );
}

/** What a dragged tree node carries; uploads from the system use "Files". */
export const DRAG_TYPE = "application/x-hyperbook-path";

/** A node of the tree the context menu is about; null is the book's root. */
type MenuNode = { path: string; isFolder: boolean } | null;

/** A visible row of the tree: flattened, so rows memoize cheaply. */
type Row = {
  path: string;
  name: string;
  isFolder: boolean;
  depth: number;
  /** The row a new file's or folder's name is typed into. */
  draft?: boolean;
};

/** The draft row's key; no path of the book has a NUL. */
const DRAFT = "\0draft";

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

/** A row's context menu on a touch screen, which may have no long press for it. */
function RowActions({
  name,
  onClick,
}: {
  name: string;
  onClick: (event: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="hidden shrink-0 rounded p-1.5 text-muted-foreground hover:bg-background pointer-coarse:block"
      aria-label={t("editor.files.actions", { name })}
      onClick={onClick}
    >
      <EllipsisIcon className="size-4" />
    </button>
  );
}

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
  isSelected,
  isCut,
  isDirty,
  isDropTarget,
  comments,
  readOnly,
  top,
  index,
  measure,
  onRowClick,
  onRowKey,
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
  /** Picked by a click, for Cut, Copy, Delete and dragging. */
  isSelected: boolean;
  isCut: boolean;
  isDirty: boolean;
  isDropTarget: boolean;
  /** Open comment threads on the file. */
  comments: number;
  readOnly: boolean;
} & PlaceProps & {
    onRowClick: (event: React.MouseEvent, path: string, isFolder: boolean, index: number) => void;
    onRowKey: (event: React.KeyboardEvent, path: string, isFolder: boolean, index: number) => void;
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
        draggable={!readOnly}
        onDragStart={(e) => onDragStart(e, path, isFolder)}
        onContextMenu={(e) => onMenu(e, { path, isFolder })}
        className={cn(
          "group flex items-center rounded-md pr-1 text-sm hover:bg-accent",
          readOnly ? "cursor-pointer" : "cursor-grab",
          isActive && "bg-accent font-semibold text-primary",
          isSelected &&
            "bg-primary/15 ring-1 ring-primary/40 ring-inset hover:bg-primary/20",
          isCut && "opacity-50",
          isFolder && isDropTarget && "bg-secondary ring-2 ring-primary",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left pointer-coarse:py-2"
          onClick={(e) => onRowClick(e, path, isFolder, index)}
          onKeyDown={(e) => onRowKey(e, path, isFolder, index)}
          data-selected={isSelected || undefined}
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
          {comments > 0 && (
            <CommentBadge count={comments} />
          )}
          {isDirty && (
            <span
              className="ml-1 size-2 shrink-0 rounded-full bg-primary"
              title={t("editor.files.notSaved")}
            />
          )}
        </button>
        <RowActions
          name={name}
          onClick={(e) => onMenu(e, { path, isFolder })}
        />
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
  comments,
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
  comments: number;
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
          className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 text-left pointer-coarse:py-2"
          onClick={() => onOpen(path)}
        >
          <FileIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate font-mono">
            {highlight(path, positions)}
          </span>
          {comments > 0 && (
            <CommentBadge count={comments} />
          )}
          {isDirty && (
            <span
              className="ml-1 size-2 shrink-0 rounded-full bg-primary"
              title={t("editor.files.notSaved")}
            />
          )}
        </button>
        <RowActions
          name={path}
          onClick={(e) => onMenu(e, { path, isFolder: false })}
        />
      </div>
    </li>
  );
});

/**
 * A row whose name is typed in place: a new file's or folder's, or a new
 * name. Enter or leaving the field takes it, Escape or an empty name drops
 * it. While being created, an error (the name is taken, say) stays at the
 * field; a rename hands over and closes, its errors are toasts.
 */
function EditRow({
  edit,
  initial,
  depth,
  validate,
  onSubmit,
  onCancel,
  top,
  index,
  measure,
}: {
  edit: TreeEdit;
  initial: string;
  depth: number;
  /** What is wrong with a typed name, if anything. */
  validate: (name: string) => string | null;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
} & PlaceProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** Taken or dropped: the blur that follows must not take it again. */
  const done = useRef(false);
  const isFolder = edit.kind === "folder" || (edit.kind === "rename" && edit.isFolder);

  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.focus();
    // A name is mostly changed before its extension.
    const dot = isFolder ? -1 : field.value.indexOf(".", 1);
    field.setSelectionRange(0, dot === -1 ? field.value.length : dot);
  }, [isFolder]);

  const problem = value.trim() ? validate(value) : null;
  const error = failure ?? problem;

  const take = async () => {
    if (done.current || busy) return;
    const name = value.trim();
    if (!name || name === initial) {
      done.current = true;
      return onCancel();
    }
    if (problem) return;
    done.current = true;
    setBusy(true);
    try {
      await onSubmit(name);
    } catch (err) {
      done.current = false;
      setFailure(err instanceof Error ? err.message : t("common.somethingWrong"));
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const hint =
    edit.kind === "folder"
      ? t("editor.files.newFolderHint")
      : edit.kind === "file" && /^(book|glossary)(\/|$)/.test(edit.folder)
        ? t("editor.files.newPageHint")
        : null;
  const label =
    edit.kind === "rename"
      ? t("editor.files.renameLabel", { name: initial })
      : edit.kind === "folder"
        ? t("editor.files.newFolderLabel")
        : t("editor.files.newFileLabel");

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
        className="flex items-center gap-1 py-0.5 pr-1 text-sm"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isFolder ? (
          <FolderIcon
            className="ml-3.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <FileIcon
            className="ml-4.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <input
          ref={input}
          value={value}
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          aria-label={label}
          aria-invalid={error !== null}
          aria-describedby={error || hint ? "tree-edit-note" : undefined}
          placeholder={
            edit.kind === "folder"
              ? t("editor.files.newFolderPlaceholder")
              : edit.kind === "file"
                ? t("editor.files.newFilePlaceholder")
                : undefined
          }
          className={cn(
            "h-6 min-w-0 flex-1 rounded-sm border bg-background px-1 outline-none focus:ring-2 pointer-coarse:h-8",
            error
              ? "border-destructive focus:ring-destructive/40"
              : "border-primary focus:ring-primary/30",
          )}
          onChange={(e) => {
            setValue(e.target.value);
            setFailure(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              void take();
            } else if (e.key === "Escape") {
              e.preventDefault();
              done.current = true;
              onCancel();
            }
          }}
          onBlur={() => {
            // A name with a problem is dropped rather than kept half-typed.
            if (problem && !done.current) {
              done.current = true;
              return onCancel();
            }
            void take();
          }}
        />
      </div>
      {(error || hint) && (
        <p
          id="tree-edit-note"
          className={cn(
            "pr-1 pb-1 text-xs",
            error ? "text-destructive" : "text-muted-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 26}px` }}
        >
          {error ?? hint}
        </p>
      )}
    </li>
  );
}

/** The number of open comment threads on a file. */
function CommentBadge({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 text-xs text-secondary-foreground"
      title={t("comments.badge", { count })}
    >
      <MessageSquareIcon className="size-3" aria-hidden />
      {count}
      <span className="sr-only">{t("comments.badge", { count })}</span>
    </span>
  );
}

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
  readOnly = false,
  comments,
  edit,
  onEdit,
  onSelect,
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
  /** Commenters: no new files, uploads, moves, renames or deletes. */
  readOnly?: boolean;
  /** Open comment threads by file, for the badges. */
  comments?: ReadonlyMap<string, number>;
  /** The name being typed in place, if any; owned by the sidebar, for its header buttons. */
  edit: TreeEdit | null;
  /** Starts typing a name in place (null stops). */
  onEdit: (edit: TreeEdit | null) => void;
  /** A row was clicked: a folder is picked, a file picks its folder; "" is the root. */
  onSelect: (path: string, isFolder: boolean) => void;
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

  // The selected rows, path → whether a folder: a click picks one, Ctrl or
  // Cmd adds or removes one, Shift a range. The ref serves the handlers,
  // which stay stable so the memoized rows do.
  const [selection, setSelection] = useState<Map<string, boolean>>(new Map());
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  /** Where a Shift-click's range starts. */
  const anchor = useRef<string | null>(null);
  const selected = useCallback(
    () =>
      outermost(
        [...selectionRef.current].map(([path, isFolder]) => ({ path, isFolder })),
      ),
    [],
  );
  // A file opened elsewhere (a tab, quick open) is what is selected.
  useEffect(() => {
    if (active && !selectionRef.current.has(active)) {
      setSelection(new Map([[active, false]]));
      anchor.current = active;
    }
  }, [active]);
  // What is gone is no longer selected.
  useEffect(() => {
    setSelection((prev) => {
      const paths = new Set(files.map((f) => f.path));
      const keep = [...prev].filter(
        ([path, isFolder]) =>
          paths.has(path) ||
          (isFolder && files.some((f) => f.path.startsWith(path + "/"))),
      );
      return keep.length === prev.size ? prev : new Map(keep);
    });
  }, [files]);

  /** Rename in place, unless the file (or one in the folder) has unsaved changes. */
  const rename = useCallback(
    (path: string, isFolder: boolean) => {
      if (actions.canRename(path, isFolder))
        onEdit({ kind: "rename", path, isFolder });
    },
    [actions, onEdit],
  );

  /** Every file's and folder's path, to tell a name that is taken. */
  const taken = useMemo(() => {
    const paths = new Set<string>();
    for (const { path } of files) {
      paths.add(path);
      let cut = -1;
      while ((cut = path.indexOf("/", cut + 1)) !== -1)
        paths.add(path.slice(0, cut));
    }
    return paths;
  }, [files]);

  const validate = useCallback(
    (name: string) => {
      if (!edit) return null;
      if (edit.kind === "rename" && name.includes("/"))
        return t("validation.nameWithoutSlash");
      const path = editTarget(edit, name);
      const problem = bookPathProblem(path);
      if (problem) return t(problem);
      const same =
        edit.kind === "rename" && path.toLowerCase() === edit.path.toLowerCase();
      if (!same && taken.has(path))
        return t("editor.actions.existsAlready", { path });
      return null;
    },
    [edit, taken, t],
  );

  const submit = useCallback(
    async (name: string) => {
      if (!edit) return;
      const path = editTarget(edit, name);
      if (edit.kind === "rename") {
        onEdit(null);
        if (path !== edit.path) actions.rename(edit.path, path, edit.isFolder);
        return;
      }
      await actions.create(path, edit.kind === "folder");
      onEdit(null);
    },
    [edit, actions, onEdit],
  );
  const cancel = useCallback(() => onEdit(null), [onEdit]);

  /**
   * The tree's context menu, in the looks of the editor's: for a file or a
   * folder, or (node null) for the empty space below them, the book's root.
   * Paste and the new files go into the folder, or next to the file.
   */
  const showMenu = useCallback(
    (event: React.MouseEvent, node: MenuNode) => {
      event.preventDefault();
      event.stopPropagation();
      // A right-click on what is selected is about all of it; elsewhere,
      // about that one, which becomes the selection.
      const many = node !== null && selectionRef.current.size > 1 && selectionRef.current.has(node.path);
      if (node && !many) setSelection(new Map([[node.path, node.isFolder]]));
      const nodes: NodeRef[] = many ? selected() : node ? [node] : [];
      const folder =
        node === null
          ? ""
          : node.isFolder
            ? node.path
            : node.path.slice(0, Math.max(0, node.path.lastIndexOf("/")));
      const { x, y } = menuPoint(event.nativeEvent);
      if (readOnly) {
        if (!node || node.isFolder) return;
        openMenu(x, y, (box) => {
          item(box, t("editor.files.download"), () => actions.download(node.path));
        }, { focusFirst: fromKeyboard(event.nativeEvent) });
        return;
      }
      if (many) {
        openMenu(x, y, (box) => {
          item(box, t("editor.files.cut"), () => actions.cut(nodes));
          item(box, t("editor.files.copy"), () => actions.copy(nodes));
          separator(box);
          item(box, t("editor.files.deleteMany", { count: nodes.length }), () => actions.remove(nodes), {
            destructive: true,
          });
        }, { focusFirst: fromKeyboard(event.nativeEvent) });
        return;
      }
      openMenu(x, y, (box) => {
        if (node === null || node.isFolder) {
          item(box, t("editor.files.newFile"), () =>
            onEdit({ kind: "file", folder }),
          );
          item(box, t("editor.files.newFolder"), () =>
            onEdit({ kind: "folder", folder }),
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
          item(box, t("editor.files.cut"), () => actions.cut(nodes));
          item(box, t("editor.files.copy"), () => actions.copy(nodes));
        }
        item(box, t("editor.files.paste"), () => actions.paste(folder), {
          disabled: clipboard === null,
        });
        if (node) {
          separator(box);
          item(box, t("editor.files.rename"), () => rename(node.path, node.isFolder));
          item(
            box,
            t("editor.files.delete"),
            () => actions.remove(nodes),
            { destructive: true },
          );
        }
      }, { focusFirst: fromKeyboard(event.nativeEvent) });
    },
    [t, actions, clipboard, readOnly, onEdit, rename, selected],
  );

  const dragStart = useCallback(
    (event: React.DragEvent, path: string, isFolder: boolean) => {
      // Dragging a selected row drags the whole selection.
      const nodes =
        selectionRef.current.has(path) && selectionRef.current.size > 1
          ? selected()
          : [{ path, isFolder }];
      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(nodes));
      event.dataTransfer.setData("text/plain", nodes.map((n) => n.path).join("\n"));
      event.dataTransfer.effectAllowed = "copyMove";
    },
    [selected],
  );

  const dragOver = useCallback((event: React.DragEvent, folder: string) => {
    if (readOnly) return;
    const upload = event.dataTransfer.types.includes("Files");
    if (!upload && !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = upload ? "copy" : "move";
    setDropTarget(folder);
  }, [readOnly]);

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
      actions.move(JSON.parse(payload) as NodeRef[], folder);
    },
    [actions],
  );

  /** Cut and not pasted yet: shown faded, like file managers do. */
  const isCut = useCallback(
    (path: string) =>
      clipboard?.cut === true &&
      clipboard.nodes.some(
        (node) => path === node.path || path.startsWith(node.path + "/"),
      ),
    [clipboard],
  );

  // The open folders' rows, flattened: indentation by depth, not by nesting.
  // A new file's or folder's name is typed in a draft row, first in its
  // folder (which the sidebar unfolded).
  const draftIn =
    edit && edit.kind !== "rename" ? edit.folder : null;
  const rows = useMemo(() => {
    const out: Row[] = [];
    const draft = (depth: number) =>
      out.push({ path: DRAFT, name: "", isFolder: false, depth, draft: true });
    if (draftIn === "") draft(0);
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        out.push({
          path: node.path,
          name: node.name,
          isFolder: node.children !== null,
          depth,
        });
        if (node.children && !collapsed.has(node.path)) {
          if (draftIn === node.path) draft(depth + 1);
          walk(node.children, depth + 1);
        }
      }
    };
    walk(tree, 0);
    // A folder that has no files yet ("a/b" typed for a new file's name
    // never makes one), or a collapsed one: the draft goes on top.
    if (draftIn !== null && !out.some((row) => row.draft)) {
      out.unshift({ path: DRAFT, name: "", isFolder: false, depth: 0, draft: true });
    }
    return out;
  }, [tree, collapsed, draftIn]);

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
  // Names are typed into the tree, not the filtered list (the sidebar
  // clears the filter for it).
  const list: (Row | FileEntry | RankedMatch)[] = edit ? rows : (matching ?? rows);
  const filtered = list !== rows;

  // Only the rows near the viewport are in the DOM, however big the book is.
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // Sizes are kept by path, not by index: a row that comes or goes (the
    // taller row a name is typed in) must not leave its size to the next.
    getItemKey: (index) => list[index]!.path,
    // The rows start below the scroll area's top padding.
    scrollMargin: 4,
    overscan: 10,
  });

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /** Moves the focus to a row, scrolling it into view first. */
  const focusRow = useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index, { align: "auto" });
      const focus = (tries: number) => {
        const button = scrollRef.current?.querySelector<HTMLElement>(
          `li[data-index="${index}"] button`,
        );
        if (button) button.focus();
        else if (tries > 0) requestAnimationFrame(() => focus(tries - 1));
      };
      requestAnimationFrame(() => focus(3));
    },
    [virtualizer],
  );

  const rowClick = useCallback(
    (event: React.MouseEvent, path: string, isFolder: boolean, index: number) => {
      const all = rowsRef.current;
      if (event.shiftKey && anchor.current !== null) {
        const from = all.findIndex((row) => row.path === anchor.current);
        if (from !== -1) {
          const [a, b] = from < index ? [from, index] : [index, from];
          setSelection(
            new Map(
              all
                .slice(a, b + 1)
                .filter((row) => !row.draft)
                .map((row) => [row.path, row.isFolder]),
            ),
          );
          return;
        }
      }
      if (event.ctrlKey || event.metaKey) {
        setSelection((prev) => {
          const next = new Map(prev);
          if (next.has(path)) next.delete(path);
          else next.set(path, isFolder);
          return next;
        });
        anchor.current = path;
        return;
      }
      setSelection(new Map([[path, isFolder]]));
      anchor.current = path;
      onSelect(path, isFolder);
      if (isFolder) toggle(path);
      else actions.open(path);
    },
    [actions, onSelect, toggle],
  );

  /**
   * The tree from the keyboard: arrows move (Shift adds to the selection),
   * Left and Right fold and unfold, Enter opens, F2 renames, Delete deletes,
   * Ctrl+C, X and V copy, cut and paste.
   */
  const rowKey = useCallback(
    (event: React.KeyboardEvent, path: string, isFolder: boolean, index: number) => {
      const all = rowsRef.current;
      const mod = event.ctrlKey || event.metaKey;
      const go = (to: number) => {
        if (to < 0 || to >= all.length) return;
        event.preventDefault();
        const row = all[to]!;
        if (row.draft) return;
        if (event.shiftKey) {
          setSelection((prev) => new Map(prev).set(row.path, row.isFolder));
        } else {
          setSelection(new Map([[row.path, row.isFolder]]));
          anchor.current = row.path;
          onSelect(row.path, row.isFolder);
        }
        focusRow(to);
      };
      const nodes = () =>
        selectionRef.current.has(path) ? selected() : [{ path, isFolder }];
      switch (event.key) {
        case "ArrowDown":
          return go(index + 1);
        case "ArrowUp":
          return go(index - 1);
        case "Home":
          return go(0);
        case "End":
          return go(all.length - 1);
        case "ArrowRight":
          if (!isFolder) return;
          event.preventDefault();
          if (collapsed.has(path)) toggle(path);
          else if (all[index + 1]?.path.startsWith(path + "/")) go(index + 1);
          return;
        case "ArrowLeft": {
          event.preventDefault();
          if (isFolder && !collapsed.has(path)) return toggle(path);
          const parent = parentOf(path);
          if (parent) go(all.findIndex((row) => row.path === parent));
          return;
        }
        case "Escape":
          setSelection(new Map([[path, isFolder]]));
          return;
      }
      if (readOnly) return;
      if (event.key === "F2") {
        event.preventDefault();
        rename(path, isFolder);
      } else if (event.key === "Delete" || (event.key === "Backspace" && event.metaKey)) {
        event.preventDefault();
        actions.remove(nodes());
      } else if (mod && (event.key === "c" || event.key === "x")) {
        event.preventDefault();
        if (event.key === "c") actions.copy(nodes());
        else actions.cut(nodes());
      } else if (mod && event.key === "v") {
        event.preventDefault();
        actions.paste(isFolder ? path : parentOf(path));
      } else if (mod && event.key === "a") {
        event.preventDefault();
        setSelection(new Map(all.filter((row) => !row.draft).map((row) => [row.path, row.isFolder])));
      }
    },
    [actions, collapsed, focusRow, onSelect, readOnly, rename, selected, toggle],
  );

  // The row a name is typed into is scrolled to.
  const editing = edit ? (edit.kind === "rename" ? edit.path : DRAFT) : null;
  useEffect(() => {
    if (editing === null) return;
    const at = rows.findIndex((row) => row.path === editing);
    if (at !== -1) virtualizer.scrollToIndex(at, { align: "auto" });
    // Only when an edit starts, not while the tree changes under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-1">
      <div
        className={cn("min-h-full pb-8", dropTarget === "" && "bg-secondary")}
        onDragOver={(e) => dragOver(e, "")}
        onDragLeave={(e) => dragLeave(e, "")}
        onDrop={(e) => drop(e, "")}
        onContextMenu={(e) => showMenu(e, null)}
        onClick={(e) => {
          // A click below the files picks the book's root.
          if (e.target === e.currentTarget) onSelect("", true);
        }}
      >
        <ul
          aria-label={t("editor.files.title")}
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = list[item.index]!;
            if (
              edit &&
              ((row as Row).draft ||
                (edit.kind === "rename" && row.path === edit.path))
            )
              return (
                <EditRow
                  key={row.path}
                  edit={edit}
                  initial={edit.kind === "rename" ? (row as Row).name : ""}
                  depth={(row as Row).depth}
                  validate={validate}
                  onSubmit={submit}
                  onCancel={cancel}
                  top={item.start}
                  index={item.index}
                  measure={virtualizer.measureElement}
                />
              );
            return filtered ? (
              <FilterRow
                key={row.path}
                path={row.path}
                positions={(row as RankedMatch).positions}
                isActive={row.path === active}
                isCut={isCut(row.path)}
                isDirty={dirty.has(row.path)}
                comments={comments?.get(row.path) ?? 0}
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
                // Several rows, or the folder new files go into; a lone
                // file shows as the open one.
                isSelected={
                  selection.has(row.path) &&
                  (selection.size > 1 || (row as Row).isFolder)
                }
                isCut={isCut(row.path)}
                isDirty={dirty.has(row.path)}
                isDropTarget={dropTarget === row.path}
                comments={(row as Row).isFolder ? 0 : (comments?.get(row.path) ?? 0)}
                readOnly={readOnly}
                top={item.start}
                index={item.index}
                measure={virtualizer.measureElement}
                onRowClick={rowClick}
                onRowKey={rowKey}
                onMenu={showMenu}
                onDragStart={dragStart}
                onDragOver={dragOver}
                onDragLeave={dragLeave}
                onDrop={drop}
              />
            );
          })}
          {filtered && matching!.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("editor.files.noMatches")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});
