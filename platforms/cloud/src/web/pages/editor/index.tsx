import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PanelRightIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router";
import { toast } from "sonner";
import type { FileChange } from "../../../shared/schemas";
import { type Reference, rewriteText } from "../../../shared/references";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, unwrap } from "@/lib/api";
import { type Book, useBook } from "@/lib/books";
import { useEditorSettings, type EditorSettings } from "@/lib/editor-settings";
import { cn } from "@/lib/utils";
import { LogDialog } from "../publishing";
import { CodeEditor, type SpellOptions } from "./code-editor";
import {
  ChoiceDialog,
  type ChoiceRequest,
  PathDialog,
  type PathRequest,
} from "./dialogs";
import { FileTree, type TreeClipboard } from "./file-tree";
import {
  type Listing,
  copyName,
  extension,
  fetchListing,
  type ReferencesResult,
  fetchReferences,
  pageOf,
  rawUrl,
  starter,
  toBase64,
} from "./files";
import { RefactorDialog, type RefactorRequest } from "./references-dialog";
import { PreviewPane } from "./preview";
import { VisualFrame, visualKind, visualProblem } from "./visual-frame";
import { PublishButton, useBuilds } from "./publish";
import { type Block, type InlineBlock, resolveSrc } from "./blocks";
import { BlockDialog } from "./block-dialog";
import { SettingsDialog } from "./settings-dialog";
import { PageSettingsDialog } from "./page-settings-dialog";
import { withPageForm } from "./frontmatter";
import {
  addDictionaryWord,
  fetchDictionary,
  removeDictionaryWord,
} from "./dictionary";
import { QuickOpen } from "./quick-open";
import { SettingsMenu, WordsDialog } from "./settings-menu";
import { Splitter, usePaneWidth } from "./splitter";
import {
  ConflictError,
  type Tab,
  type Workspace,
  isDirty,
  useLiveText,
  useWorkspace,
} from "./workspace";

export function Component() {
  const id = useParams().id!;
  const { data: book } = useBook(id);
  const { data: listing } = useQuery({
    queryKey: ["books", id, "files"],
    queryFn: () => fetchListing(id),
  });
  if (!book || !listing) return null;
  if (book.source === "external") {
    return (
      <Centered>
        <p>This book is hosted elsewhere, so it is not edited here.</p>
        <BackLink book={book} />
      </Centered>
    );
  }
  if (listing.commit === null) return <StartBook book={book} />;
  return <Editor book={book} listing={listing} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-[15vh] grid max-w-md gap-4 px-4 text-center">
      {children}
    </div>
  );
}

function BackLink({ book }: { book: Book }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <ArrowLeftIcon className="size-4" /> {book.title}
    </Link>
  );
}

/** A new book has no files: start from a template (or upload a zip on the book page). */
function StartBook({ book }: { book: Book }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const start = async (template: "default" | "empty") => {
    setBusy(true);
    try {
      const res = await unwrap(
        api.books[":id"].files.init.$post({
          param: { id: String(book.id) },
          json: { template },
        }),
      );
      queryClient.setQueryData(["books", String(book.id), "files"], {
        commit: res.commit,
        files: res.files,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
      setBusy(false);
    }
  };
  return (
    <Centered>
      <h1 className="text-2xl">{book.title} has no files yet</h1>
      <p className="text-muted-foreground">
        Start with a few example pages, or with a single empty page.
      </p>
      <div className="flex justify-center gap-2">
        <Button disabled={busy} onClick={() => void start("default")}>
          Example pages
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void start("empty")}
        >
          Empty book
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Have a book already? Upload it as a zip on the{" "}
        <Link to={`/books/${book.id}`} className="text-primary hover:underline">
          book's page
        </Link>
        .
      </p>
    </Centered>
  );
}

const parentOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const join = (folder: string, name: string) =>
  folder ? `${folder}/${name}` : name;
/** Every folder a path is in, e.g. "book/a/b.md" → ["book", "book/a"]. */
const foldersOf = (path: string) =>
  path
    .split("/")
    .slice(0, -1)
    .map((_, i, all) => all.slice(0, i + 1).join("/"));

function Editor({ book, listing }: { book: Book; listing: Listing }) {
  const bookId = String(book.id);
  const ws = useWorkspace(bookId, listing);
  const { data: builds } = useBuilds(bookId);
  // The book's language: struktolab's keywords depend on it.
  const { data: bookLanguage = "en" } = useQuery({
    queryKey: [
      "books",
      bookId,
      "language",
      listing.files.find((f) => f.path === "hyperbook.json")?.oid,
    ],
    queryFn: async () =>
      (
        await unwrap(
          api.books[":id"].files.language.$get({ param: { id: bookId } }),
        )
      ).language,
    placeholderData: (previous) => previous,
  });
  const queryClient = useQueryClient();
  const [pathRequest, setPathRequest] = useState<PathRequest | null>(null);
  /** What the file tree's Copy or Cut picked, for its Paste. */
  const [treeClipboard, setTreeClipboard] = useState<TreeClipboard | null>(
    null,
  );
  const [choice, setChoice] = useState<ChoiceRequest | null>(null);
  /** What a rename, move or delete is about to do to the file's references. */
  const [refactor, setRefactor] = useState<RefactorRequest | null>(null);
  const [logFor, setLogFor] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [blockEdit, setBlockEdit] = useState<{
    block: InlineBlock;
    view: EditorView;
  } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [showWords, setShowWords] = useState(false);
  // The file tree's state, for the sidebar's header buttons.
  const [treeCollapsed, setTreeCollapsed] = useState<Set<string>>(new Set());
  const [treeFilter, setTreeFilter] = useState("");
  const [settings, updateSettings] = useEditorSettings();
  // The panes' widths, remembered from the last session; null means the default.
  const [sidebarWidth, setSidebarWidth] = usePaneWidth(
    "editor-sidebar-width",
    180,
  );
  const [previewWidth, setPreviewWidth] = usePaneWidth(
    "editor-preview-width",
    320,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  // The book's own spell-check words (see routes/dictionary.ts).
  const { data: dictionary } = useQuery({
    queryKey: ["books", bookId, "dictionary"],
    queryFn: () => fetchDictionary(bookId),
  });
  const spellWords = useMemo(
    () => new Set(dictionary?.words ?? []),
    [dictionary?.words],
  );
  const canSpellCheck = bookLanguage === "en" || bookLanguage === "de";

  /** "Edit visually" in a page: a structogram in a dialog, an element file in its tab. */
  const editBlock = (page: string, block: Block, view: EditorView) => {
    if (block.type === "inline") return setBlockEdit({ block, view });
    const file = resolveSrc(block.src, page, exists);
    if (file) return ws.open(file);
    // The file the directive names is missing: offer to start it next to the
    // page, the last place the build looks for a src (readFile in the markdown
    // package), so the directive starts working once it is saved. A page at
    // the root has no folder, so its srcs live in book/ itself.
    const dir = page.includes("/")
      ? page.slice(0, page.lastIndexOf("/"))
      : "book";
    const path = `${dir}/${block.src.replace(/^\//, "")}`;
    setChoice({
      title: `Create ${block.src}?`,
      description: `"${block.src}" is not in the book yet. It is created next to ${page} and opens in its own tab.`,
      choices: [
        {
          label: "Create",
          run: () =>
            void commitAndOpen(
              [
                {
                  op: "write",
                  path,
                  content: starter(path, bookLanguage),
                  baseOid: null,
                },
              ],
              path,
            ),
        },
      ],
    });
  };
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadFolder = useRef("");
  const replaceTarget = useRef<string | null>(null);
  const exists = (path: string) => listing.files.some((f) => f.path === path);

  // Open the start page once.
  useEffect(() => {
    const first = ["book/index.md", "README.md", "hyperbook.json"].find(exists);
    if (first) ws.open(first);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ask before leaving with unsaved changes.
  const hasUnsaved = ws.dirty.size > 0;
  const blocker = useBlocker(hasUnsaved);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    setChoice({
      title: "Leave without saving?",
      description: `${ws.dirty.size} file(s) have changes that are not saved.`,
      choices: [
        {
          label: "Leave",
          variant: "destructive",
          run: () => blocker.proceed(),
        },
      ],
    });
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  // Ctrl/Cmd+S saves the open file wherever the focus is, not just in its
  // editor, instead of the browser saving the page.
  const saveActive = useRef(() => {});
  saveActive.current = () => {
    if (ws.active) void save([ws.active]);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "s" ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        e.shiftKey
      )
        return;
      // The file's editor saved it already.
      if (
        e.defaultPrevented &&
        (e.target as Element | null)?.closest?.(".cm-editor")
      )
        return;
      e.preventDefault();
      saveActive.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/Cmd+P opens the quick-open popup instead of the browser's print.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "p" ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        e.shiftKey
      )
        return;
      e.preventDefault();
      setQuickOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fail = (error: unknown) =>
    toast.error(
      error instanceof Error ? error.message : "Something went wrong",
    );

  /** Adds a word to the book's dictionary; the pages re-check. */
  const addWord = useCallback(
    async (word: string) => {
      try {
        const res = await addDictionaryWord(bookId, word);
        queryClient.setQueryData(["books", bookId, "dictionary"], res);
        toast.success(`“${word}” was added to the dictionary.`);
      } catch (error) {
        fail(error);
      }
    },
    [bookId, queryClient], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const removeWord = async (word: string) => {
    try {
      const res = await removeDictionaryWord(bookId, word);
      queryClient.setQueryData(["books", bookId, "dictionary"], res);
    } catch (error) {
      fail(error);
    }
  };

  /** Spell check for pages: the book's language and its accepted words. */
  const spell = {
    enabled: settings.spellCheck && canSpellCheck,
    language: bookLanguage,
    words: spellWords,
    onAddWord: (word: string) => void addWord(word),
  };

  /** Saves files; a conflict asks what to do. */
  const save = async (paths: string[]) => {
    for (const tab of ws
      .currentTabs()
      .filter((t) => paths.includes(t.path) && isDirty(t))) {
      const kind = visualKind(tab.path);
      const problem = kind && visualProblem(kind, tab.text!);
      if (problem)
        return fail(new Error(`${tab.path} was not saved. ${problem}`));
    }
    try {
      await ws.save(paths);
    } catch (error) {
      if (!(error instanceof ConflictError)) return fail(error);
      const conflicts = error.paths;
      const current = await fetchListing(bookId);
      const oid = (p: string) =>
        current.files.find((f) => f.path === p)?.oid ?? null;
      setChoice({
        title: "Someone else saved in the meantime",
        description: (
          <>
            <p>These files were changed since you opened them:</p>
            <ul className="my-2 list-disc pl-5 font-mono text-sm">
              {conflicts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p>
              Keep your version as a copy, replace theirs with yours, or drop
              your changes.
            </p>
          </>
        ),
        choices: [
          {
            label: "Drop mine",
            variant: "outline",
            run: async () => {
              await Promise.all(conflicts.map((p) => ws.reload(p)));
            },
          },
          {
            label: "Save mine as a copy",
            variant: "outline",
            run: async () => {
              const taken = (p: string) =>
                current.files.some((f) => f.path === p);
              const tabs = ws
                .currentTabs()
                .filter((t) => conflicts.includes(t.path));
              try {
                await ws.commit(
                  tabs.map((t) => ({
                    op: "write",
                    path: copyName(t.path, taken),
                    content: t.text!,
                    baseOid: null,
                  })),
                );
                await Promise.all(conflicts.map((p) => ws.reload(p)));
                toast.success("Your version was saved as a copy.");
              } catch (err) {
                fail(err);
              }
            },
          },
          {
            label: "Replace theirs",
            variant: "destructive",
            run: async () => {
              try {
                await ws.save(
                  paths,
                  Object.fromEntries(conflicts.map((p) => [p, oid(p)])),
                );
              } catch (err) {
                fail(err);
              }
            },
          },
        ],
      });
    }
  };

  const busyFiles = (paths: string[]) => {
    const unsaved = paths.filter((p) => ws.dirty.has(p));
    if (unsaved.length > 0) {
      toast.error(`Save or close ${unsaved[0]} first.`);
      return true;
    }
    return false;
  };

  const filesIn = (folder: string) =>
    listing.files
      .filter((f) => f.path.startsWith(folder + "/"))
      .map((f) => f.path);

  const commitAndOpen = async (changes: FileChange[], open?: string) => {
    await ws.commit(changes).catch((error) => {
      throw error instanceof ConflictError
        ? new Error(`${error.paths[0]} exists already`)
        : error;
    });
    if (open) ws.open(open);
  };

  const failCommit = (error: unknown) => {
    fail(
      error instanceof ConflictError
        ? new Error("Someone else changed these files; try again.")
        : error,
    );
  };

  /** A move's old → new for the rewrite: files, and folders the scan pointed at (an archives folder). */
  const moveOf =
    (moves: Map<string, string>) =>
    (path: string): string | null => {
      const hit = moves.get(path);
      if (hit !== undefined) return hit;
      for (const [from, to] of moves)
        if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
      for (const [from, to] of moves)
        if (from.startsWith(`${path}/`))
          return to.slice(0, to.length - (from.length - path.length));
      return null;
    };

  /** Commits a move of every file in `moves`; the open tabs follow their files. */
  const commitMoves = async (moves: Map<string, string>, writes: FileChange[] = [], message?: string) => {
    const moves2: FileChange[] = [...moves].map(([from, to]) => ({
      op: "move" as const,
      from,
      to,
      baseOid: ws.oidOf(from)!,
    }));
    await ws.commit([...moves2, ...writes], message);
    ws.renameTabs(moves);
  };

  /** Writes the new addresses into the pages that reference a moved file. */
  const updateWrites = (
    scanned: ReferencesResult,
    move: (path: string) => string | null,
  ): (FileChange & { op: "write" })[] => {
    const byFile = new Map<string, Reference[]>();
    for (const ref of scanned.references) {
      const list = byFile.get(ref.file) ?? [];
      list.push(ref);
      byFile.set(ref.file, list);
    }
    const writes: (FileChange & { op: "write" })[] = [];
    for (const [file, refs] of byFile) {
      const info = scanned.files.find((f) => f.path === file)!;
      const { text } = rewriteText(info.text, refs, move);
      writes.push({ op: "write", path: file, content: text, baseOid: info.oid });
    }
    return writes;
  };

  /** Moves the files in `moves`, asking first when something references them. */
  const moveWithReferences = async (
    from: string,
    moves: Map<string, string>,
    label: "Rename" | "Move",
  ) => {
    let scanned: ReferencesResult;
    try {
      scanned = await fetchReferences(bookId, from);
    } catch (error) {
      return fail(error);
    }
    if (scanned.references.length === 0)
      return commitMoves(moves).catch(failCommit);
    // Unsaved changes in a referencing page cannot be rewritten safely.
    const dirty = scanned.files.filter((f) => ws.dirty.has(f.path)).map((f) => f.path);
    if (dirty.length > 0) {
      toast.error(`Save or close ${dirty[0]} first; it references ${from}.`);
      return;
    }
    const texts = Object.fromEntries(scanned.files.map((f) => [f.path, f.text]));
    const count = scanned.references.length;
    setRefactor({
      title: `${label} ${from}?`,
      lead: (
        <p>
          {count} place{count === 1 ? "" : "s"} in {scanned.files.length} page
          {scanned.files.length === 1 ? "" : "s"} point{scanned.files.length === 1 && count === 1 ? "s" : ""} at {from}.{" "}
          Moving it rewrites their addresses to the new path, or leaves them as they are.
        </p>
      ),
      references: scanned.references,
      texts,
      choices: [
        {
          label: `${label} without updating`,
          variant: "outline",
          run: () => commitMoves(moves).catch(failCommit),
        },
        {
          label: `${label} and update ${count} reference${count === 1 ? "" : "s"}`,
          run: async () => {
            const writes = updateWrites(scanned, moveOf(moves));
            try {
              await commitMoves(moves, writes, `${label} ${from}`);
              for (const w of writes)
                if (ws.tabs.some((t) => t.path === w.path)) void ws.reload(w.path);
              toast.success(`${label}d ${from}; ${count} reference${count === 1 ? "" : "s"} updated.`);
            } catch (error) {
              failCommit(error);
            }
          },
        },
      ],
    });
  };

  /** Uploads files into `folder`; resolves to whether it worked. */
  const upload = async (folder: string, files: File[]): Promise<boolean> => {
    try {
      const changes: (FileChange & { op: "write" })[] = [];
      for (const file of files) {
        const path = join(folder, file.name);
        changes.push({
          op: "write",
          path,
          encoding: "base64",
          content: toBase64(new Uint8Array(await file.arrayBuffer())),
          baseOid: ws.oidOf(path),
        });
      }
      await ws.commit(changes);
      for (const ch of changes)
        if (ws.tabs.some((t) => t.path === ch.path)) void ws.reload(ch.path);
      toast.success(
        files.length === 1
          ? `Uploaded ${files[0]!.name}`
          : `Uploaded ${files.length} files`,
      );
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const actions = {
    open: ws.open,
    download: (path: string) => {
      const a = document.createElement("a");
      a.href = rawUrl(bookId, path);
      a.download = path.split("/").pop()!;
      a.click();
    },
    newFile: (folder: string) =>
      setPathRequest({
        title: "New file",
        description: "Pages are Markdown files (.md) in the book folder.",
        label: "Path",
        initial: join(folder, "new-page.md"),
        submitLabel: "Create",
        onSubmit: (path) =>
          commitAndOpen(
            [{ op: "write", path, content: starter(path), baseOid: null }],
            path,
          ),
      }),
    newFolder: (folder: string) =>
      setPathRequest({
        title: "New folder",
        description:
          "A folder exists through its files, so it starts with an index.md page.",
        label: "Folder",
        initial: join(folder, "chapter"),
        submitLabel: "Create",
        onSubmit: (path) => {
          const index = `${path}/index.md`;
          return commitAndOpen(
            [
              {
                op: "write",
                path: index,
                content: starter(index),
                baseOid: null,
              },
            ],
            index,
          );
        },
      }),
    pickUpload: (folder: string) => {
      uploadFolder.current = folder;
      replaceTarget.current = null;
      uploadInput.current?.click();
    },
    upload: (folder: string, files: File[]) => void upload(folder, files),
    rename: (path: string, isFolder: boolean) => {
      const affected = isFolder ? filesIn(path) : [path];
      if (busyFiles(affected)) return;
      // Only the name: moving is dragging, or Cut and Paste.
      setPathRequest({
        title: isFolder ? "Rename folder" : "Rename file",
        label: "Name",
        initial: path.split("/").pop()!,
        folder: parentOf(path),
        submitLabel: "Rename",
        onSubmit: async (to) => {
          if (to === path) return;
          const moves = new Map(
            affected.map((p) => [p, to + p.slice(path.length)]),
          );
          await moveWithReferences(path, moves, "Rename");
        },
      });
    },
    remove: (path: string, isFolder: boolean) => {
      const affected = isFolder ? filesIn(path) : [path];
      const deleteThem = async () => {
        try {
          await ws.commit(
            affected.map((p) => ({
              op: "delete" as const,
              path: p,
              baseOid: ws.oidOf(p)!,
            })),
          );
          for (const p of affected) ws.close(p);
        } catch (error) {
          failCommit(error);
        }
      };
      void (async () => {
        let scanned: ReferencesResult;
        try {
          scanned = await fetchReferences(bookId, path);
        } catch (error) {
          return fail(error);
        }
        const base = isFolder
          ? `This deletes the folder and its ${affected.length} file(s). Older versions stay in the book's history.`
          : "Older versions stay in the book's history.";
        if (scanned.references.length === 0)
          return setChoice({
            title: `Delete ${path}?`,
            description: base,
            choices: [
              { label: "Delete", variant: "destructive", run: deleteThem },
            ],
          });
        const count = scanned.references.length;
        setRefactor({
          title: `Delete ${path}?`,
          lead: (
            <p>
              {base} {count} place{count === 1 ? "" : "s"} in {scanned.files.length} page
              {scanned.files.length === 1 ? "" : "s"} point{count === 1 && scanned.files.length === 1 ? "s" : ""} at it and
              will break:
            </p>
          ),
          references: scanned.references,
          texts: Object.fromEntries(
            scanned.files.map((f) => [f.path, f.text]),
          ),
          choices: [
            {
              label: `Delete anyway (${count} reference${count === 1 ? "" : "s"} break${count === 1 ? "s" : ""})`,
              variant: "destructive",
              run: deleteThem,
            },
          ],
        });
      })();
    },
    move: (from: string, to: string, isFolder: boolean) => {
      const name = from.split("/").pop()!;
      const dest = to ? `${to}/${name}` : name;
      if (dest === from) return; // Dropped where it already is.
      if (isFolder && (to === from || to.startsWith(from + "/")))
        return toast.error("A folder cannot be moved into itself.");
      const affected = isFolder ? filesIn(from) : [from];
      if (affected.length === 0 || busyFiles(affected)) return;
      const moves = new Map(
        affected.map((p) => [p, dest + p.slice(from.length)]),
      );
      void moveWithReferences(from, moves, "Move");
    },
    copy: (path: string, isFolder: boolean) =>
      setTreeClipboard({ path, isFolder, cut: false }),
    cut: (path: string, isFolder: boolean) =>
      setTreeClipboard({ path, isFolder, cut: true }),
    paste: async (folder: string) => {
      const clip = treeClipboard;
      if (!clip) return;
      if (clip.cut) {
        // Cut once, pasted once: the files are gone from where they were.
        setTreeClipboard(null);
        return actions.move(clip.path, folder, clip.isFolder);
      }
      const affected = clip.isFolder ? filesIn(clip.path) : [clip.path];
      if (affected.length === 0)
        return toast.error(`${clip.path} does not exist anymore.`);
      if (busyFiles(affected)) return;
      // Next to the original, or anywhere its name is taken, a copy's name.
      const taken = (p: string) =>
        listing.files.some((f) => f.path === p || f.path.startsWith(p + "/"));
      let dest = join(folder, clip.path.split("/").pop()!);
      if (taken(dest)) dest = copyName(dest, taken);
      try {
        const changes = await Promise.all(
          affected.map(async (from): Promise<FileChange> => {
            const res = await fetch(rawUrl(bookId, from));
            if (!res.ok) throw new Error(`Could not copy ${from}`);
            return {
              op: "write",
              path: dest + from.slice(clip.path.length),
              encoding: "base64",
              content: toBase64(new Uint8Array(await res.arrayBuffer())),
              baseOid: null,
            };
          }),
        );
        await commitAndOpen(changes, clip.isFolder ? undefined : dest);
      } catch (error) {
        fail(error);
      }
    },
  };

  const closeTab = (tab: Tab) => {
    if (!isDirty(tab)) return ws.close(tab.path);
    setChoice({
      title: `Close ${tab.path}?`,
      description: "Your changes to this file are not saved.",
      choices: [
        {
          label: "Close without saving",
          variant: "destructive",
          run: () => ws.close(tab.path),
        },
        {
          label: "Save and close",
          run: async () => {
            await save([tab.path]);
            ws.close(tab.path);
          },
        },
      ],
    });
  };

  const onPublish = (publish: () => Promise<void>) => {
    if (!hasUnsaved) return void publish();
    setChoice({
      title: "Publish with unsaved changes?",
      description: "Only saved changes are published.",
      choices: [
        { label: "Publish saved version", variant: "outline", run: publish },
        {
          label: "Save all and publish",
          run: async () => {
            await save([...ws.dirty]);
            await publish();
          },
        },
      ],
    });
  };

  const activeTab = ws.tabs.find((t) => t.path === ws.active);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 py-2">
        <BackLink book={book} />
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          disabled={!exists("hyperbook.json")}
          onClick={() => {
            if (!busyFiles(["hyperbook.json"])) setShowSettings(true);
          }}
        >
          Book settings
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasUnsaved}
          onClick={() => void save([...ws.dirty])}
        >
          Save all
        </Button>
        <PublishButton
          bookId={bookId}
          commit={listing.commit}
          builds={builds}
          hasUnsaved={hasUnsaved}
          onPublish={onPublish}
          onShowLog={setLogFor}
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={showPreview ? "Hide preview" : "Show preview"}
          aria-pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
        >
          <PanelRightIcon className="size-4" />
        </Button>
        <SettingsMenu
          settings={settings}
          update={updateSettings}
          canSpellCheck={canSpellCheck}
          onOpenWords={() => setShowWords(true)}
        />
        <ThemeToggle className="hover:bg-accent [&_svg]:size-4" />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          ref={sidebarRef}
          className="flex w-64 shrink-0 flex-col bg-sidebar"
          style={sidebarWidth === null ? undefined : { width: sidebarWidth }}
        >
          <div className="flex items-center gap-1 border-b border-sidebar-border px-2 py-1">
            <span className="flex-1 text-sm font-medium">Files</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Expand all folders"
              disabled={treeFilter.trim() !== ""}
              onClick={() => setTreeCollapsed(new Set())}
            >
              <ChevronsDownUpIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Collapse all folders"
              disabled={treeFilter.trim() !== ""}
              onClick={() =>
                setTreeCollapsed(
                  new Set(listing.files.flatMap((f) => foldersOf(f.path))),
                )
              }
            >
              <ChevronsUpDownIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="New file"
              onClick={() =>
                actions.newFile(ws.active ? parentOf(ws.active) : "book")
              }
            >
              <FilePlusIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="New folder"
              onClick={() =>
                actions.newFolder(ws.active ? parentOf(ws.active) : "book")
              }
            >
              <FolderPlusIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Upload files"
              onClick={() =>
                actions.pickUpload(ws.active ? parentOf(ws.active) : "book")
              }
            >
              <UploadIcon className="size-4" />
            </Button>
          </div>
          <div className="border-b border-sidebar-border p-2">
            <div className="relative">
              <SearchIcon
                className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
                placeholder="Filter files"
                aria-label="Filter files"
                className="h-7 pl-7 text-sm"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <FileTree
              files={listing.files}
              active={ws.active}
              dirty={ws.dirty}
              actions={actions}
              clipboard={treeClipboard}
              collapsed={treeCollapsed}
              setCollapsed={setTreeCollapsed}
              filter={treeFilter}
            />
          </div>
        </aside>
        <Splitter
          label="Resize the file list"
          pane={sidebarRef}
          direction={1}
          onResize={setSidebarWidth}
          onReset={() => setSidebarWidth(null)}
          className="bg-sidebar-border"
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <div
            role="tablist"
            className="flex shrink-0 overflow-x-auto border-b border-border"
          >
            {ws.tabs.map((tab) => (
              <div
                key={tab.path}
                className={cn(
                  "group flex shrink-0 items-center border-r border-border text-sm",
                  tab.path === ws.active
                    ? "bg-background font-medium text-primary"
                    : "bg-sidebar text-muted-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.path === ws.active}
                  title={tab.path}
                  className="py-1.5 pr-1 pl-3"
                  onClick={() => ws.setActive(tab.path)}
                >
                  {tab.path.split("/").pop()}
                  {isDirty(tab) && (
                    <span
                      className="ml-1.5 inline-block size-2 rounded-full bg-primary"
                      title="Not saved"
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="mr-1 rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
                  aria-label={`Close ${tab.path}`}
                  onClick={() => closeTab(tab)}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            {ws.tabs.map((tab) => (
              <div
                key={tab.path}
                className={cn(
                  "absolute inset-0",
                  tab.path !== ws.active && "hidden",
                )}
              >
                <TabContent
                  ws={ws}
                  tab={tab}
                  files={listing.files.map((f) => f.path)}
                  settings={settings}
                  spell={spell}
                  onEditBlock={(block, view) =>
                    editBlock(tab.path, block, view)
                  }
                  onChange={(text) => ws.setText(tab.path, text)}
                  onSave={() => void save([tab.path])}
                  onReplace={() => {
                    uploadFolder.current = parentOf(tab.path);
                    replaceTarget.current = tab.path;
                    uploadInput.current?.click();
                  }}
                  onDownload={() => actions.download(tab.path)}
                />
              </div>
            ))}
            {!activeTab && (
              <p className="p-8 text-center text-muted-foreground">
                Open a file from the list on the left, or press Ctrl+P.
              </p>
            )}
          </div>
        </main>

        {showPreview && (
          <>
            <Splitter
              label="Resize the preview"
              pane={previewRef}
              direction={-1}
              onResize={setPreviewWidth}
              onReset={() => setPreviewWidth(null)}
              className="hidden lg:block"
            />
            <section
              ref={previewRef}
              className="hidden w-[45%] max-w-3xl shrink-0 lg:block"
              style={
                previewWidth === null
                  ? undefined
                  : { width: previewWidth, maxWidth: "none" }
              }
              aria-label="Preview"
            >
              <LivePreview
                ws={ws}
                bookId={bookId}
                file={
                  activeTab &&
                  pageOf(activeTab.path) &&
                  activeTab.status === "ready"
                    ? activeTab.path
                    : null
                }
                commit={listing.commit}
              />
            </section>
          </>
        )}
      </div>

      <input
        ref={uploadInput}
        type="file"
        multiple
        className="sr-only"
        aria-label="Choose files to upload"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length === 0) return;
          const target = replaceTarget.current;
          if (target) {
            // Replacing a file keeps its name.
            const renamed = new File([files[0]!], target.split("/").pop()!, {
              type: files[0]!.type,
            });
            void upload(parentOf(target), [renamed]);
          } else {
            void upload(uploadFolder.current, files);
          }
        }}
      />
      <PathDialog request={pathRequest} onClose={() => setPathRequest(null)} />
      <ChoiceDialog
        request={choice}
        onClose={() => {
          setChoice(null);
          if (blocker.state === "blocked") blocker.reset();
        }}
      />
      <RefactorDialog request={refactor} onClose={() => setRefactor(null)} />
      <LogDialog buildId={logFor} onClose={() => setLogFor(null)} />
      <QuickOpen
        open={quickOpen}
        files={listing.files.map((f) => f.path)}
        tabs={ws.tabs.map((t) => t.path)}
        onClose={() => setQuickOpen(false)}
        onOpen={ws.open}
      />
      <WordsDialog
        open={showWords}
        words={dictionary?.words ?? []}
        onRemove={(word) => void removeWord(word)}
        onClose={() => setShowWords(false)}
      />
      <BlockDialog
        edit={
          blockEdit && {
            ...blockEdit.block,
            lang: blockEdit.block.lang ?? bookLanguage,
          }
        }
        onApply={(code) => {
          const { block, view } = blockEdit!;
          // An edit of the page like any other: undoable, saved with the page.
          view.dispatch({
            changes: { from: block.from, to: block.to, insert: code },
          });
          view.focus();
        }}
        onClose={() => setBlockEdit(null)}
      />
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        bookId={bookId}
        files={listing.files.map((f) => f.path)}
        onEditJson={() => {
          setShowSettings(false);
          ws.open("hyperbook.json");
        }}
        onSave={async (content, baseOid) => {
          try {
            await ws.commit(
              [{ op: "write", path: "hyperbook.json", content, baseOid }],
              "Change the book's settings",
            );
          } catch (error) {
            throw error instanceof ConflictError
              ? new Error("Someone else changed the settings; open them again.")
              : error;
          }
          if (ws.tabs.some((t) => t.path === "hyperbook.json"))
            void ws.reload("hyperbook.json");
          toast.success("Settings saved.");
        }}
      />
    </div>
  );
}

/** The preview follows the page's text as it is typed; the editor around it does not render for that. */
function LivePreview({
  ws,
  file,
  ...props
}: {
  ws: Workspace;
  bookId: string;
  file: string | null;
  commit: string | null;
}) {
  const text = useLiveText(ws, file);
  return (
    <PreviewPane
      {...props}
      file={file}
      text={file === null ? null : (text ?? null)}
    />
  );
}

function TabContent({
  ws,
  tab,
  files,
  settings,
  spell,
  onEditBlock,
  onChange,
  onSave,
  onReplace,
  onDownload,
}: {
  ws: Workspace;
  tab: Tab;
  files: string[];
  settings: EditorSettings;
  spell: SpellOptions;
  onEditBlock: (block: Block, view: EditorView) => void;
  onChange: (text: string) => void;
  onSave: () => void;
  onReplace: () => void;
  onDownload: () => void;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const [pageSettings, setPageSettings] = useState<{
    view: EditorView;
    text: string;
    path: string;
  } | null>(null);
  if (tab.status === "loading")
    return <p className="p-4 text-muted-foreground">Loading…</p>;
  if (tab.status === "error")
    return <p className="p-4 text-destructive">{tab.error}</p>;
  const loaded = tab.loaded!;
  if (loaded.kind === "text") {
    const kind = visualKind(tab.path);
    // Both views start from the current text, so switching keeps unsaved changes.
    const source = (
      <CodeEditor
        key={`${tab.path}:${tab.version}`}
        path={tab.path}
        initial={ws.textOf(tab.path)!}
        onChange={onChange}
        onSave={onSave}
        onEditBlock={onEditBlock}
        onPageSettings={(view) =>
          setPageSettings({
            view,
            text: view.state.doc.toString(),
            path: tab.path,
          })
        }
        files={files}
        settings={settings}
        spell={spell}
        onReady={(view) => (viewRef.current = view)}
      />
    );
    if (pageOf(tab.path)) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center border-b border-border px-2 py-0.5">
            <span className="hidden text-xs text-muted-foreground md:inline">
              Type : at the start of a line for elements
            </span>
          </div>
          <div className="min-h-0 flex-1">{source}</div>
          <PageSettingsDialog
            text={pageSettings?.text ?? null}
            path={pageSettings?.path ?? null}
            pages={files.flatMap((f) =>
              f.startsWith("book/") ? (pageOf(f) ?? []) : [],
            )}
            onApply={(form) => {
              const { view } = pageSettings!;
              const text = view.state.doc.toString();
              // An edit of the page like any other: undoable, saved with the page.
              view.dispatch({
                changes: {
                  from: 0,
                  to: text.length,
                  insert: withPageForm(text, form),
                },
              });
              view.focus();
            }}
            onClose={() => setPageSettings(null)}
          />
        </div>
      );
    }
    if (!kind) return source;
    return (
      <VisualOrSource
        ws={ws}
        tab={tab}
        kind={kind}
        source={source}
        onChange={onChange}
        onSave={onSave}
      />
    );
  }
  const size = `${(loaded.size / 1024).toFixed(loaded.size < 10240 ? 1 : 0)} KB`;
  return (
    <div className="grid h-full content-start justify-items-center gap-4 overflow-auto p-6">
      {loaded.kind === "image" ? (
        <img
          src={loaded.url}
          alt={tab.path}
          className="max-h-[60vh] max-w-full rounded-md border border-border object-contain"
        />
      ) : (
        <p className="max-w-md text-center text-muted-foreground">
          {extension(tab.path) === "h5p"
            ? "H5P content is made in an H5P editor (e.g. Lumi or ZUM Apps) and replaced here. It plays in the preview of the pages that show it."
            : "This file cannot be edited here."}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {tab.path} · {size}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          Download
        </Button>
        <Button variant="outline" size="sm" onClick={onReplace}>
          Replace…
        </Button>
      </div>
    </div>
  );
}

function VisualOrSource({
  ws,
  tab,
  kind,
  source,
  onChange,
  onSave,
}: {
  ws: Workspace;
  tab: Tab;
  kind: NonNullable<ReturnType<typeof visualKind>>;
  source: React.ReactNode;
  onChange: (text: string) => void;
  onSave: () => void;
}) {
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const text = useLiveText(ws, tab.path)!;
  const problem = visualProblem(kind, text);
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1"
        role="group"
        aria-label="View"
      >
        {(["visual", "source"] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? "secondary" : "ghost"}
            aria-pressed={mode === m}
            disabled={m === "visual" && problem !== null}
            title={m === "visual" && problem ? problem : undefined}
            onClick={() => setMode(m)}
          >
            {m === "visual" ? "Visual" : "Source"}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {mode === "visual" ? (
          <VisualFrame
            key={`${tab.path}:${tab.version}`}
            kind={kind}
            text={text}
            onChange={onChange}
            onSave={onSave}
          />
        ) : (
          source
        )}
      </div>
    </div>
  );
}
