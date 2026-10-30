import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PanelRightIcon,
  SearchIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FileChange } from "../../../shared/schemas";
import { type Reference, rewriteText } from "../../../shared/references";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, unwrap } from "@/lib/api";
import { type Book, useBook } from "@/lib/books";
import { useEditorSettings, type EditorSettings } from "@/lib/editor-settings";
import { useAiStatus } from "@/lib/ai";
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
  fileAt,
  type ReferencesResult,
  fetchReferences,
  pageOf,
  rawUrl,
  starter,
  starterEncoding,
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
import { AiPanel } from "./ai-panel";
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
  const { t } = useTranslation();
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
        <p>{t("editor.start.external")}</p>
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
  const { t } = useTranslation();
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
      toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));
      setBusy(false);
    }
  };
  return (
    <Centered>
      <h1 className="text-2xl">{t("editor.start.noFiles", { title: book.title })}</h1>
      <p className="text-muted-foreground">{t("editor.start.hint")}</p>
      <div className="flex justify-center gap-2">
        <Button disabled={busy} onClick={() => void start("default")}>
          {t("editor.start.examplePages")}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void start("empty")}
        >
          {t("editor.start.emptyBook")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        <Trans
          i18nKey="editor.start.haveBook"
          components={{
            a: <Link to={`/books/${book.id}`} className="text-primary hover:underline" />,
          }}
        />
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
  const { t } = useTranslation();
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
  const [showAi, setShowAi] = useState(false);
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
  const aiRef = useRef<HTMLElement>(null);
  const [aiWidth, setAiWidth] = usePaneWidth("editor-ai-width", 280);
  // The open files' editors, by path: the AI panel reads the active one's
  // selection at action time, and inserts its answer through it.
  const views = useRef(new Map<string, EditorView>()).current;
  const aiStatus = useAiStatus();
  const aiAvailable =
    (aiStatus.data?.enabled ?? false) && (aiStatus.data?.allowed ?? false);

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
      title: t("editor.actions.createTitle", { name: block.src }),
      description: t("editor.actions.createDescription", {
        name: block.src,
        page,
      }),
      choices: [
        {
          label: t("editor.actions.create"),
          run: () =>
            void commitAndOpen(
              [
                {
                  op: "write",
                  path,
                  content: starter(path, bookLanguage),
                  encoding: starterEncoding(path),
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
      title: t("editor.actions.leaveTitle"),
      description: t("editor.actions.leaveDescription", { count: ws.dirty.size }),
      choices: [
        {
          label: t("editor.actions.leave"),
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

  // Ctrl/Cmd+Alt+A toggles the AI assistant's pane, when this teacher may
  // use it. The latest answer is read at keypress time, not on every render.
  const toggleAi = useRef(() => {});
  toggleAi.current = () => {
    if (aiAvailable) setShowAi((open) => !open);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "a" ||
        !(e.ctrlKey || e.metaKey) ||
        !e.altKey ||
        e.shiftKey
      )
        return;
      e.preventDefault();
      toggleAi.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fail = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("common.somethingWrong"));

  /** Adds a word to the book's dictionary; the pages re-check. */
  const addWord = useCallback(
    async (word: string) => {
      try {
        const res = await addDictionaryWord(bookId, word);
        queryClient.setQueryData(["books", bookId, "dictionary"], res);
        toast.success(t("editor.actions.addedWordToast", { word }));
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
        return fail(
          new Error(t("editor.actions.savedProblem", { path: tab.path, problem })),
        );
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
        title: t("editor.actions.conflictTitle"),
        description: (
          <>
            <p>{t("editor.actions.conflictIntro")}</p>
            <ul className="my-2 list-disc pl-5 font-mono text-sm">
              {conflicts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p>{t("editor.actions.conflictOutro")}</p>
          </>
        ),
        choices: [
          {
            label: t("editor.actions.dropMine"),
            variant: "outline",
            run: async () => {
              await Promise.all(conflicts.map((p) => ws.reload(p)));
            },
          },
          {
            label: t("editor.actions.saveMineAsCopy"),
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
                toast.success(t("editor.actions.savedAsCopyToast"));
              } catch (err) {
                fail(err);
              }
            },
          },
          {
            label: t("editor.actions.replaceTheirs"),
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
      toast.error(t("editor.actions.saveFirst", { path: unsaved[0] }));
      return true;
    }
    return false;
  };

  const filesIn = (folder: string) =>
    listing.files
      .filter((f) => f.path.startsWith(folder + "/"))
      .map((f) => f.path);

  const commitAndOpen = async (changes: FileChange[], open?: string) => {
    await ws.commit(changes).catch((error: unknown) => {
      throw error instanceof ConflictError
        ? new Error(
            t("editor.actions.existsAlready", { path: error.paths[0] }),
          )
        : error;
    });
    if (open) ws.open(open);
  };

  const failCommit = (error: unknown) => {
    fail(
      error instanceof ConflictError
        ? new Error(t("editor.actions.changedElsewhere"))
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
    kind: "rename" | "move",
  ) => {
    const label = t(kind === "rename" ? "editor.files.rename" : "editor.files.move");
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
      toast.error(
        t("editor.actions.saveFirstReferencing", { path: dirty[0], from }),
      );
      return;
    }
    const texts = Object.fromEntries(scanned.files.map((f) => [f.path, f.text]));
    const count = scanned.references.length;
    const lead =
      count === 1 && scanned.files.length === 1
        ? t("editor.actions.moveLead_one", { path: from })
        : t("editor.actions.moveLead_other", {
            count,
            pages: scanned.files.length,
            path: from,
          });
    setRefactor({
      title: t("editor.actions.moveTitle", { label, path: from }),
      lead: <p>{lead}</p>,
      references: scanned.references,
      texts,
      choices: [
        {
          label: t("editor.actions.moveWithout", { label }),
          variant: "outline",
          run: () => commitMoves(moves).catch(failCommit),
        },
        {
          label: t("editor.actions.moveAndUpdate", { label, count }),
          run: async () => {
            const writes = updateWrites(scanned, moveOf(moves));
            try {
              await commitMoves(moves, writes, `${label} ${from}`);
              for (const w of writes)
                if (ws.tabs.some((t) => t.path === w.path)) void ws.reload(w.path);
              toast.success(
                kind === "rename"
                  ? t("editor.actions.renamedToast", { path: from, count })
                  : t("editor.actions.movedToast", { path: from, count }),
              );
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
          ? t("editor.actions.uploadedToast_one", { name: files[0]!.name })
          : t("editor.actions.uploadedToast_other", { count: files.length }),
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
        title: t("editor.actions.newFileTitle"),
        description: t("editor.actions.newFileDescription"),
        label: t("editor.actions.pathLabel"),
        initial: join(folder, "new-page.md"),
        submitLabel: t("editor.actions.create"),
        onSubmit: (path) =>
          commitAndOpen(
            [{ op: "write", path, content: starter(path), encoding: starterEncoding(path), baseOid: null }],
            path,
          ),
      }),
    newFolder: (folder: string) =>
      setPathRequest({
        title: t("editor.actions.newFolderTitle"),
        description: t("editor.actions.newFolderDescription"),
        label: t("editor.actions.folderLabel"),
        initial: join(folder, "chapter"),
        submitLabel: t("editor.actions.create"),
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
        title: isFolder
          ? t("editor.actions.renameFolderTitle")
          : t("editor.actions.renameFileTitle"),
        label: t("editor.actions.nameLabel"),
        initial: path.split("/").pop()!,
        folder: parentOf(path),
        submitLabel: t("editor.actions.rename"),
        onSubmit: async (to) => {
          if (to === path) return;
          const moves = new Map(
            affected.map((p) => [p, to + p.slice(path.length)]),
          );
          await moveWithReferences(path, moves, "rename");
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
          ? t("editor.actions.deleteFolderDescription", { count: affected.length })
          : t("editor.actions.deleteFileDescription");
        if (scanned.references.length === 0)
          return setChoice({
            title: t("editor.actions.deleteTitle", { path }),
            description: base,
            choices: [
              {
                label: t("common.delete"),
                variant: "destructive",
                run: deleteThem,
              },
            ],
          });
        const count = scanned.references.length;
        const lead =
          count === 1 && scanned.files.length === 1
            ? t("editor.actions.deleteLead_one")
            : t("editor.actions.deleteLead_other", {
                count,
                pages: scanned.files.length,
              });
        setRefactor({
          title: t("editor.actions.deleteTitle", { path }),
          lead: <p>{base} {lead}</p>,
          references: scanned.references,
          texts: Object.fromEntries(
            scanned.files.map((f) => [f.path, f.text]),
          ),
          choices: [
            {
              label: t("editor.actions.deleteAnyway", { count }),
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
        return toast.error(t("editor.actions.folderIntoItself"));
      const affected = isFolder ? filesIn(from) : [from];
      if (affected.length === 0 || busyFiles(affected)) return;
      const moves = new Map(
        affected.map((p) => [p, dest + p.slice(from.length)]),
      );
      void moveWithReferences(from, moves, "move");
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
        return toast.error(t("editor.actions.gone", { path: clip.path }));
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
            if (!res.ok)
              throw new Error(t("editor.actions.couldNotCopy", { path: from }));
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
      title: t("editor.actions.closeTitle", { path: tab.path }),
      description: t("editor.actions.closeDescription"),
      choices: [
        {
          label: t("editor.actions.closeWithoutSaving"),
          variant: "destructive",
          run: () => ws.close(tab.path),
        },
        {
          label: t("editor.actions.saveAndClose"),
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
      title: t("editor.actions.publishUnsavedTitle"),
      description: t("editor.actions.publishUnsavedDescription"),
      choices: [
        {
          label: t("editor.actions.publishSavedVersion"),
          variant: "outline",
          run: publish,
        },
        {
          label: t("editor.actions.saveAllAndPublish"),
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
          {t("editor.toolbar.bookSettings")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasUnsaved}
          onClick={() => void save([...ws.dirty])}
        >
          {t("editor.toolbar.saveAll")}
        </Button>
        <PublishButton
          bookId={bookId}
          commit={listing.commit}
          builds={builds}
          hasUnsaved={hasUnsaved}
          onPublish={onPublish}
          onShowLog={setLogFor}
        />
        {aiAvailable && (
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={
              showAi ? t("editor.toolbar.hideAi") : t("editor.toolbar.showAi")
            }
            aria-pressed={showAi}
            onClick={() => setShowAi((v) => !v)}
          >
            <SparklesIcon className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={showPreview ? t("editor.toolbar.hidePreview") : t("editor.toolbar.showPreview")}
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
            <span className="flex-1 text-sm font-medium">{t("editor.files.title")}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("editor.files.expandAll")}
              disabled={treeFilter.trim() !== ""}
              onClick={() => setTreeCollapsed(new Set())}
            >
              <ChevronsDownUpIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("editor.files.collapseAll")}
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
              aria-label={t("editor.files.newFile")}
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
              aria-label={t("editor.files.newFolder")}
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
              aria-label={t("editor.files.uploadFiles")}
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
                placeholder={t("editor.files.filter")}
                aria-label={t("editor.files.filter")}
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
          label={t("editor.toolbar.resizeFiles")}
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
                      title={t("editor.files.notSaved")}
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="mr-1 rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
                  aria-label={t("editor.tabs.close", { path: tab.path })}
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
                  onView={(path, view) => {
                    if (view) views.set(path, view);
                    else views.delete(path);
                  }}
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
                {t("editor.tabs.noFileOpen")}
              </p>
            )}
          </div>
        </main>

        {showAi && aiAvailable && (
          <>
            <Splitter
              label={t("editor.toolbar.resizeAi")}
              pane={aiRef}
              direction={-1}
              onResize={setAiWidth}
              onReset={() => setAiWidth(null)}
            />
            <section
              ref={aiRef}
              className="w-[360px] shrink-0 border-l border-border bg-sidebar"
              style={aiWidth === null ? undefined : { width: aiWidth }}
              aria-label={t("editor.toolbar.ai")}
            >
              <AiPanel
                bookId={book.id}
                activePath={activeTab?.path ?? null}
                getViewOf={(path) => views.get(path) ?? null}
                isTabOpen={(path) =>
                  ws.currentTabs().some((tab) => tab.path === path)
                }
                isTabDirty={ws.dirtyOf}
                closeTab={ws.close}
                reloadTab={ws.reload}
                commit={ws.commit}
              />
            </section>
          </>
        )}

        {showPreview && (
          <>
            <Splitter
              label={t("editor.toolbar.resizePreview")}
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
              aria-label={t("editor.toolbar.preview")}
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
                onNavigate={(href) => {
                  const target = fileAt(
                    href,
                    listing.files.map((f) => f.path),
                  );
                  if (target) ws.open(target);
                  return target !== null;
                }}
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
        aria-label={t("editor.files.chooseFiles")}
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
        onUpload={(files) => upload("public", files)}
        onEditJson={() => {
          setShowSettings(false);
          ws.open("hyperbook.json");
        }}
        onSave={async (content, baseOid) => {
          try {
            await ws.commit(
              [{ op: "write", path: "hyperbook.json", content, baseOid }],
              t("editor.actions.settingsCommit"),
            );
          } catch (error) {
            throw error instanceof ConflictError
              ? new Error(t("editor.actions.settingsConflict"))
              : error;
          }
          if (ws.tabs.some((t) => t.path === "hyperbook.json"))
            void ws.reload("hyperbook.json");
          toast.success(t("editor.actions.settingsSavedToast"));
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
  onNavigate: (href: string) => boolean;
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
  onView,
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
  /** Reports the tab's editor while it lives, for the AI panel. */
  onView: (path: string, view: EditorView | null) => void;
  onChange: (text: string) => void;
  onSave: () => void;
  onReplace: () => void;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  const viewRef = useRef<EditorView | null>(null);
  const [pageSettings, setPageSettings] = useState<{
    view: EditorView;
    text: string;
    path: string;
  } | null>(null);
  if (tab.status === "loading")
    return <p className="p-4 text-muted-foreground">{t("common.loading")}</p>;
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
        onReady={(view) => {
          viewRef.current = view;
          onView(tab.path, view);
        }}
      />
    );
    if (pageOf(tab.path)) {
      return (
        <div className="flex h-full flex-col">
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
          {extension(tab.path) === "h5p" ? t("editor.tabs.h5p") : t("editor.tabs.cannotEdit")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {tab.path} · {size}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          {t("editor.tabs.download")}
        </Button>
        <Button variant="outline" size="sm" onClick={onReplace}>
          {t("editor.tabs.replace")}
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
  const { t } = useTranslation();
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const text = useLiveText(ws, tab.path)!;
  const problem = visualProblem(kind, text);
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1"
        role="group"
        aria-label={t("editor.tabs.view")}
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
            {m === "visual" ? t("editor.tabs.visual") : t("editor.tabs.source")}
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
