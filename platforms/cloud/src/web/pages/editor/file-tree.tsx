import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
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
      !!a.children === !!b.children ? a.name.localeCompare(b.name) : a.children ? -1 : 1,
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
};

export function FileTree({
  files,
  active,
  dirty,
  actions,
}: {
  files: FileEntry[];
  active: string | null;
  dirty: Set<string>;
  actions: TreeActions;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const dropProps = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
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
      if (dropped.length > 0) actions.upload(folder, dropped);
    },
  });

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const isFolder = node.children !== null;
      const open = isFolder && !collapsed.has(node.path);
      return (
        <li key={node.path} {...(isFolder ? dropProps(node.path) : {})}>
          <div
            className={cn(
              "group flex items-center rounded-md pr-1 text-sm hover:bg-accent",
              node.path === active && "bg-accent font-semibold text-primary",
              isFolder && dropTarget === node.path && "bg-secondary ring-2 ring-primary",
            )}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
              onClick={() => (isFolder ? toggle(node.path) : actions.open(node.path))}
              aria-expanded={isFolder ? open : undefined}
            >
              {isFolder ? (
                <>
                  {open ? <ChevronDownIcon className="size-3.5 shrink-0" /> : <ChevronRightIcon className="size-3.5 shrink-0" />}
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </>
              ) : (
                <FileIcon className="ml-4.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{node.name}</span>
              {dirty.has(node.path) && (
                <span className="ml-1 size-2 shrink-0 rounded-full bg-primary" title="Not saved" />
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
                    <DropdownMenuItem onSelect={() => actions.newFile(node.path)}>New file here</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => actions.newFolder(node.path)}>New folder here</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => actions.pickUpload(node.path)}>Upload files here</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {!isFolder && (
                  <DropdownMenuItem onSelect={() => actions.download(node.path)}>Download</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => actions.rename(node.path, isFolder)}>Rename or move</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(node.path, isFolder)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {open && <ul>{render(node.children!, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <div
      className={cn("min-h-full pb-8", dropTarget === "" && "bg-secondary")}
      {...dropProps("")}
    >
      <ul aria-label="Files">{render(tree, 0)}</ul>
    </div>
  );
}
