import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FileEntry } from "./files";

type TreeNode = { name: string; path: string; children: TreeNode[] | null };

/** Folders exist through their files; git keeps no empty folders. */
function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      if (i === parts.length - 1) {
        node.children!.push({ name: part, path, children: null });
        return;
      }
      let dir = node.children!.find((c) => c.children && c.name === part);
      if (!dir) {
        dir = { name: part, path, children: [] };
        node.children!.push(dir);
      }
      node = dir;
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
};

/** What a dragged tree node carries; uploads from the system use "Files". */
const DRAG_TYPE = "application/x-hyperbook-path";

export function FileTree({
  files,
  active,
  dirty,
  actions,
  collapsed,
  setCollapsed,
  filter,
}: {
  files: FileEntry[];
  active: string | null;
  dirty: Set<string>;
  actions: TreeActions;
  /** Which folders are collapsed; owned by the editor, for its header buttons. */
  collapsed: Set<string>;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Only files whose path matches are shown, as a flat list. */
  filter: string;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

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

  const dropProps = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      const upload = e.dataTransfer.types.includes("Files");
      if (!upload && !e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = upload ? "copy" : "move";
      setDropTarget(folder);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.stopPropagation();
      setDropTarget((t) => (t === folder ? null : t));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const dropped = [...e.dataTransfer.files];
      if (dropped.length > 0) {
        actions.upload(folder, dropped);
        return;
      }
      // A file or folder of the book, dragged to its new folder.
      const payload = e.dataTransfer.getData(DRAG_TYPE);
      if (!payload) return;
      const { path, isFolder } = JSON.parse(payload) as {
        path: string;
        isFolder: boolean;
      };
      actions.move(path, folder, isFolder);
    },
  });

  const dragProps = (node: TreeNode) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(
        DRAG_TYPE,
        JSON.stringify({ path: node.path, isFolder: node.children !== null }),
      );
      e.dataTransfer.setData("text/plain", node.path);
      e.dataTransfer.effectAllowed = "move";
    },
  });

  const row = (node: TreeNode, label: string, depth: number) => {
    const isFolder = node.children !== null;
    const open = isFolder && !collapsed.has(node.path);
    return (
      <li key={node.path} {...(isFolder ? dropProps(node.path) : {})}>
        <div
          {...dragProps(node)}
          className={cn(
            "group flex cursor-grab items-center rounded-md pr-1 text-sm hover:bg-accent",
            node.path === active && "bg-accent font-semibold text-primary",
            isFolder &&
              dropTarget === node.path &&
              "bg-secondary ring-2 ring-primary",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
            onClick={() =>
              isFolder ? toggle(node.path) : actions.open(node.path)
            }
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
            <span className="truncate">{label}</span>
            {dirty.has(node.path) && (
              <span
                className="ml-1 size-2 shrink-0 rounded-full bg-primary"
                title="Not saved"
              />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${node.name}`}
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {isFolder && (
                <>
                  <DropdownMenuItem onSelect={() => actions.newFile(node.path)}>
                    New file here
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => actions.newFolder(node.path)}
                  >
                    New folder here
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => actions.pickUpload(node.path)}
                  >
                    Upload files here
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isFolder && (
                <DropdownMenuItem onSelect={() => actions.download(node.path)}>
                  Download
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => actions.rename(node.path, isFolder)}
              >
                Rename or move
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.remove(node.path, isFolder)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {open && <ul>{render(node.children!, depth + 1)}</ul>}
      </li>
    );
  };

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => row(node, node.name, depth));

  // While filtering, the tree turns into the matching files, with their paths.
  const needle = filter.trim().toLowerCase();
  const matching = needle
    ? files
        .filter((f) => f.path.toLowerCase().includes(needle))
        .map((f) => ({ name: f.path.split("/").pop()!, path: f.path }))
    : null;

  return (
    <div
      className={cn("min-h-full pb-8", dropTarget === "" && "bg-secondary")}
      {...dropProps("")}
    >
      {matching ? (
        <ul aria-label="Files">
          {matching.map((file) => (
            <li key={file.path}>
              <div
                className={cn(
                  "group flex cursor-pointer items-center rounded-md pr-1 text-sm hover:bg-accent",
                  file.path === active &&
                    "bg-accent font-semibold text-primary",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 text-left"
                  onClick={() => actions.open(file.path)}
                >
                  <FileIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate font-mono">{file.path}</span>
                  {dirty.has(file.path) && (
                    <span
                      className="ml-1 size-2 shrink-0 rounded-full bg-primary"
                      title="Not saved"
                    />
                  )}
                </button>
              </div>
            </li>
          ))}
          {matching.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No file matches.
            </li>
          )}
        </ul>
      ) : (
        <ul aria-label="Files">{render(tree, 0)}</ul>
      )}
    </div>
  );
}
