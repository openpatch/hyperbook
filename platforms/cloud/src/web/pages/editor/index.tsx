import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BookIcon,
  ChevronDownIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  EllipsisVerticalIcon,
  FilePlusIcon,
  FolderPlusIcon,
  FilesIcon,
  ListTreeIcon,
  FolderTreeIcon,
  HistoryIcon,
  LogOutIcon,
  MessageSquareIcon,
  MoonIcon,
  PanelRightIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useParams, useSearchParams } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FileChange } from "../../../shared/schemas";
import { type Reference, rewriteText } from "../../../shared/references";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, unwrap } from "@/lib/api";
import { type Book, useBook } from "@/lib/books";
import { EditorPublishButton } from "../publish-flow";
import { useEditorSettings, type EditorSettings } from "@/lib/editor-settings";
import { useAiStatus } from "@/lib/ai";
import { COMPACT, NARROW, useMediaQuery } from "@/lib/media-query";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CodeEditor, type SpellOptions } from "./code-editor";
import {
  ChoiceDialog,
  PathList,
  type ChoiceRequest,
} from "./dialogs";
import { fromKeyboard, item, menuPoint, openMenu, separator } from "./context-menu";
import { type DropHandler, dropPath, fileDrop, linkTo } from "./file-drop";
import {
  editFolder,
  FileTree,
  type NodeRef,
  outermost,
  parentOf,
  type TreeActions,
  type TreeClipboard,
  type TreeEdit,
} from "./file-tree";
import {
  type Listing,
  copyName,
  extension,
  fetchListing,
  fileAt,
  type ReferencesResult,
  fetchReferences,
  isMarkdownPage,
  pageOf,
  rawUrl,
  starter,
  starterEncoding,
  toBase64,
} from "./files";
import { RefactorDialog, type RefactorRequest } from "./references-dialog";
import { PreviewPane } from "./preview";
import { TypstPreviewPane, showTypstDiagnostics } from "./typst-preview";
import { PdfView } from "./pdf-view";
import { setBookFilesForTypstImports, setSharedTypstImports } from "./typst-imports";
import type { TypstDiagnostic } from "../../../shared/typst-diagnostics";
import { VisualFrame, visualKind, visualProblem } from "./visual-frame";
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
import { SearchPanel, useBookTexts } from "./search-panel";
import { OutlinePanel } from "./outline-panel";
import {
  type SearchMatch,
  type SearchQuery,
  type SearchResult,
  compileQuery,
  findMatches,
  replaceAll,
  replacements,
} from "../../../shared/search";
import { SettingsMenu, WordsDialog } from "./settings-menu";
import { AiPanel } from "./ai-panel";
import { HistoryPanel } from "./history-panel";
import {
  CommentsPanel,
  type Draft,
  type Thread,
  openCounts,
  threadsKey,
  useThreads,
} from "./comments-panel";
import {
  type CommentConfig,
  type EditorThread,
  applySuggestion,
  commentsExtension,
  currentAnchors,
  focusThread,
  rebaseComments,
  selectionAnchor,
  syncThreads,
} from "./comments";
import { normalizeText } from "../../../shared/comment-anchor";
import { hasEditRole } from "./roles";
import { type PdfClick, findInSource } from "./pdf-sync";
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
  if (listing.commit === null) {
    if (book.role === "commenter")
      return (
        <Centered>
          <p>{t("editor.start.nothingYet", { title: book.title })}</p>
          <BackLink book={book} />
        </Centered>
      );
    return <StartBook book={book} />;
  }
  return <Editor book={book} listing={listing} />;
}

/** "Commenting as Anna", and the way out, for visitors through an access link. */
function LinkVisitorBadge({ book }: { book: Book }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = book.viewer?.name ?? "";
  const leave = async () => {
    try {
      await unwrap(api.links.leave.$post());
    } finally {
      queryClient.clear();
      window.location.assign("/join?left");
    }
  };
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="hidden truncate rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground sm:inline">
        {book.role === "commenter"
          ? t("editor.toolbar.commentingAs", { name })
          : t("editor.toolbar.editingAs", { name })}
      </span>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void leave()}>
        <LogOutIcon className="size-3.5" aria-hidden />
        <span className="max-sm:sr-only">{t("editor.toolbar.leave")}</span>
      </Button>
    </span>
  );
}

/**
 * A link visitor's first visit: what they can do here. Remembered per link
 * in this browser only.
 */
function LinkWelcome({ book }: { book: Book }) {
  const { t } = useTranslation();
  const key = `hb-link-welcome-${book.viewer?.linkId}`;
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  });
  if (book.viewer?.kind !== "link" || seen) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-primary/5 px-3 py-2 text-sm" role="status">
      <MessageSquareIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        {book.role === "commenter" ? t("comments.welcomeCommenter") : t("comments.welcomeEditor")}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            // Private mode: shown again next time.
          }
          setSeen(true);
        }}
      >
        {t("comments.gotIt")}
      </Button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-[15vh] grid max-w-md gap-4 px-4 text-center">
      {children}
    </div>
  );
}

function BackLink({ book, className }: { book: Book; className?: string }) {
  // Link visitors have no book page to go back to.
  if (book.viewer?.kind === "link")
    return <span className={cn("truncate text-sm font-medium", className)}>{book.title}</span>;
  return (
    <Link
      to={`/books/${book.id}`}
      className={cn(
        "inline-flex items-center gap-1 text-sm text-primary hover:underline",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4 shrink-0" />
      <span className="truncate">{book.title}</span>
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
      toast.error(
        error instanceof Error ? error.message : t("common.somethingWrong"),
      );
      setBusy(false);
    }
  };
  return (
    <Centered>
      <h1 className="text-2xl">
        {t("editor.start.noFiles", { title: book.title })}
      </h1>
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
            a: (
              <Link
                to={`/books/${book.id}`}
                className="text-primary hover:underline"
              />
            ),
          }}
        />
      </p>
    </Centered>
  );
}

const join = (folder: string, name: string) =>
  folder ? `${folder}/${name}` : name;
/** Every folder a path is in, e.g. "book/a/b.md" → ["book", "book/a"]. */
const foldersOf = (path: string) =>
  path
    .split("/")
    .slice(0, -1)
    .map((_, i, all) => all.slice(0, i + 1).join("/"));

/**
 * The editor's file sidebar: its header buttons, its filter and the tree.
 * It owns the tree's collapsed folders and its filter, so typing in the
 * filter or toggling a folder re-renders the sidebar only, not the whole
 * editor. Folders start collapsed, so a big book opens fast and stays
 * clear until unfolded.
 */
const FileSidebar = memo(function FileSidebar({
  files,
  active,
  dirty,
  actions,
  clipboard,
  readOnly,
  comments,
}: {
  files: Listing["files"];
  active: string | null;
  dirty: Set<string>;
  actions: TreeActions;
  clipboard: TreeClipboard | null;
  readOnly: boolean;
  comments?: ReadonlyMap<string, number>;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(files.flatMap((f) => foldersOf(f.path))),
  );
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<TreeEdit | null>(null);
  // Where you are: the folder last clicked in the tree, or the folder of the
  // file last clicked or opened. New files and uploads go there.
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => setHere(null), [active]);
  const folder = here ?? (active ? parentOf(active) : "book");
  const select = useCallback(
    (path: string, isFolder: boolean) =>
      setHere(isFolder ? path : parentOf(path)),
    [],
  );
  /** Types a name in place: its folder unfolds and the filter clears. */
  const startEdit = useCallback((next: TreeEdit | null) => {
    if (next) {
      const target = editFolder(next);
      if (target) {
        const open = [...foldersOf(target), target];
        setCollapsed((prev) =>
          open.some((f) => prev.has(f))
            ? new Set([...prev].filter((f) => !open.includes(f)))
            : prev,
        );
      }
      setFilter("");
      if (next.kind !== "rename") setHere(next.folder);
    }
    setEdit(next);
  }, []);
  return (
    <>
      <div className="flex items-center gap-1 border-b border-sidebar-border px-2 py-1">
        <span className="flex-1 text-sm font-medium">
          {t("editor.files.title")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 pointer-coarse:size-9"
          aria-label={t("editor.files.expandAll")}
          disabled={filter.trim() !== ""}
          onClick={() => setCollapsed(new Set())}
        >
          <ChevronsDownUpIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 pointer-coarse:size-9"
          aria-label={t("editor.files.collapseAll")}
          disabled={filter.trim() !== ""}
          onClick={() =>
            setCollapsed(new Set(files.flatMap((f) => foldersOf(f.path))))
          }
        >
          <ChevronsUpDownIcon className="size-4" />
        </Button>
        {!readOnly && (
          <>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 pointer-coarse:size-9"
            aria-label={t("editor.files.newFile")}
            onClick={() => startEdit({ kind: "file", folder })}
          >
            <FilePlusIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 pointer-coarse:size-9"
            aria-label={t("editor.files.newFolder")}
            onClick={() => startEdit({ kind: "folder", folder })}
          >
            <FolderPlusIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 pointer-coarse:size-9"
            aria-label={t("editor.files.uploadFiles")}
            onClick={() => actions.pickUpload(folder)}
          >
            <UploadIcon className="size-4" />
          </Button>
          </>
        )}
      </div>
      <div className="border-b border-sidebar-border p-2">
        <div className="relative">
          <SearchIcon
            className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("editor.files.filter")}
            aria-label={t("editor.files.filter")}
            className="h-7 pl-7 text-sm pointer-coarse:h-9"
          />
        </div>
      </div>
      <FileTree
        files={files}
        active={active}
        dirty={dirty}
        actions={actions}
        clipboard={clipboard}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        filter={filter}
        readOnly={readOnly}
        comments={comments}
        edit={edit}
        onEdit={startEdit}
        onSelect={select}
      />
    </>
  );
});

/** The views of the editor's sidebar, in the order of its activity bar. */
const SIDEBAR_VIEWS = [
  "files",
  "search",
  "outline",
  "comments",
  "history",
  "ai",
] as const;
type SidebarView = (typeof SIDEBAR_VIEWS)[number];
const sidebarItems = {
  files: { label: "editor.files.title", Icon: FilesIcon },
  search: { label: "editor.search.title", Icon: SearchIcon },
  outline: { label: "editor.outline.title", Icon: ListTreeIcon },
  comments: { label: "editor.toolbar.comments", Icon: MessageSquareIcon },
  history: { label: "editor.toolbar.history", Icon: HistoryIcon },
  ai: { label: "editor.toolbar.ai", Icon: SparklesIcon },
} as const;

/** How long typing pauses before auto-save saves. */
const AUTO_SAVE_DELAY = 30_000;

function Editor({ book, listing }: { book: Book; listing: Listing }) {
  const { t, i18n } = useTranslation();
  const bookId = String(book.id);
  const ws = useWorkspace(bookId, listing, {
    onRestored: (path, stale) =>
      toast.info(
        stale
          ? t("editor.drafts.restoredStale", { path })
          : t("editor.drafts.restored", { path }),
        { id: `draft:${path}`, duration: stale ? 12_000 : 6_000 },
      ),
  });
  /** Commenters read, select and comment; nothing they do changes the book. */
  const readOnly = book.role === "commenter";
  /** Came through an access link: no account, no AI, no way to the book page. */
  const viaLink = book.viewer?.kind === "link";
  // What `#import "@…"` completes in .typ files (typst-imports.ts).
  const { data: typstImports } = useQuery({
    queryKey: ["books", bookId, "typst-packages"],
    queryFn: () => unwrap(api.books[":id"]["typst-packages"].$get({ param: { id: bookId } })),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => setSharedTypstImports(typstImports?.imports ?? []), [typstImports]);
  useEffect(() => setBookFilesForTypstImports(listing.files.map((f) => f.path)), [listing.files]);
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
  /** What the file tree's Copy or Cut picked, for its Paste. */
  const [treeClipboard, setTreeClipboard] = useState<TreeClipboard | null>(
    null,
  );
  const [choice, setChoice] = useState<ChoiceRequest | null>(null);
  /** What a rename, move or delete is about to do to the file's references. */
  const [refactor, setRefactor] = useState<RefactorRequest | null>(null);
  // A phone gets the file list as a drawer; a phone or tablet gets the side
  // panes over the editor, one at a time, the preview closed at first.
  const narrow = useMediaQuery(NARROW);
  const compact = useMediaQuery(COMPACT);
  const [showFiles, setShowFiles] = useState(false);
  const [showPreview, setShowPreview] = useState(
    () => !matchMedia(COMPACT).matches,
  );
  /** Shows or hides the preview pane. */
  const togglePane = (_pane: "preview") => setShowPreview((shown) => !shown);
  const theme = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [blockEdit, setBlockEdit] = useState<{
    block: InlineBlock;
    view: EditorView;
  } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  // The sidebar's view, chosen in its activity bar. Commenters come to
  // comment: theirs starts with the comments.
  const [sidebarView, setSidebarView] = useState<SidebarView>(() =>
    book.role === "commenter" ? "comments" : "files",
  );
  // The sidebar folded down to its activity bar, as it was left last time.
  const [sidebarFolded, setSidebarFoldedState] = useState(() => {
    try {
      return localStorage.getItem("editor-sidebar-folded") === "true";
    } catch {
      return false;
    }
  });
  const setSidebarFolded = useCallback((folded: boolean) => {
    setSidebarFoldedState(folded);
    try {
      localStorage.setItem("editor-sidebar-folded", String(folded));
    } catch {
      // Remembered for this page only.
    }
  }, []);
  /** Whether the sidebar shows its view: unfolded, or a phone's drawer open. */
  const sidebarOpen = narrow ? showFiles : !sidebarFolded;
  /** Shows a view in the sidebar, unfolding it (or opening a phone's drawer). */
  const showView = useCallback(
    (view: SidebarView) => {
      setSidebarView(view);
      setSidebarFolded(false);
      if (narrow) setShowFiles(true);
      // A compact screen's preview lies over the editor; the view comes first.
      else if (compact && view !== "files") setShowPreview(false);
    },
    [narrow, compact, setSidebarFolded],
  );
  /** The activity bar: shows a view, or folds the sidebar if it is shown. */
  const toggleView = (view: SidebarView) => {
    if (sidebarView === view && sidebarOpen) {
      if (narrow) setShowFiles(false);
      else setSidebarFolded(true);
    } else showView(view);
  };
  const [searchFocus, setSearchFocus] = useState({ count: 0, text: "" });
  /** A search result to select once its file's editor is there. */
  const [reveal, setReveal] = useState<{
    path: string;
    match: SearchMatch;
    query: SearchQuery;
  } | null>(null);
  // Quick open's props, stable so its memoized rows skip editor re-renders.
  const filePaths = useMemo(() => listing.files.map((f) => f.path), [listing]);
  const tabPaths = useMemo(() => ws.tabs.map((t) => t.path), [ws.tabs]);
  const closeQuickOpen = useCallback(() => setQuickOpen(false), []);
  const [showWords, setShowWords] = useState(false);
  const [settings, updateSettings] = useEditorSettings();
  // The panes' widths, remembered from the last session; null means the default.
  const [sidebarWidth, setSidebarWidth] = usePaneWidth(
    "editor-sidebar-width",
    // The activity bar (44px) and a usable file tree.
    224,
  );
  const [previewWidth, setPreviewWidth] = usePaneWidth(
    "editor-preview-width",
    320,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  // The open files' editors, by path: the AI panel reads the active one's
  // selection at action time, and inserts its answer through it.
  const views = useRef(new Map<string, EditorView>()).current;
  /** Changes when an editor comes or goes, for the effects that use `views`. */
  const [viewsVersion, setViewsVersion] = useState(0);

  // Comments (comments.ts, comments-panel.tsx): the book's threads, the
  // one shown in the pane, and a new one being written.
  const { data: threads } = useThreads(bookId);
  const commentCounts = useMemo(() => openCounts(threads), [threads]);
  const [activeThread, setActiveThread] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const canEdit = hasEditRole(book.role);
  /** The open threads of `path` that are still in their file, for its editor. */
  const editorThreads = (path: string): EditorThread[] =>
    (threads ?? [])
      .filter((th) => th.path === path && th.status === "open" && !th.outdated)
      .map((th) => ({
        id: th.id,
        oid: th.oid,
        from: th.from,
        to: th.to,
        quote: th.quote,
        prefix: th.prefix,
        suffix: th.suffix,
      }));
  const latestEditorThreads = useRef(editorThreads);
  latestEditorThreads.current = editorThreads;
  useEffect(() => {
    for (const [path, view] of views) syncThreads(view, editorThreads(path));
  }, [threads, viewsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Shows a thread: its file, its place in the text, and the pane. */
  const selectThread = useCallback(
    (thread: Pick<Thread, "id" | "path">) => {
      setActiveThread(thread.id);
      showView("comments");
      ws.open(thread.path);
    },
    [ws.open, showView], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Once the thread's file has its editor, the thread is scrolled to.
  useEffect(() => {
    const thread = threads?.find((th) => th.id === activeThread);
    const view = thread && views.get(thread.path);
    for (const [path, other] of views)
      if (path !== thread?.path) focusThread(other, null);
    if (view) focusThread(view, activeThread);
  }, [activeThread, viewsVersion, threads]); // eslint-disable-line react-hooks/exhaustive-deps

  // A deep link (?thread=<id>, from a comment email) opens its thread.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const wanted = Number(searchParams.get("thread"));
    const thread = wanted ? threads?.find((th) => th.id === wanted) : undefined;
    if (!thread) return;
    selectThread(thread);
    setSearchParams({}, { replace: true });
  }, [threads]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Comment" in a file's editor: a new thread on its selection. */
  const startDraft = (path: string, view: EditorView) => {
    const anchor = selectionAnchor(view);
    if (!anchor.ok) {
      if (anchor.reason === "unsaved") toast.error(t("comments.needsSave"));
      return;
    }
    setDraft({
      path,
      oid: anchor.oid,
      from: anchor.from,
      to: anchor.to,
      quote: view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      ),
    });
    setActiveThread(null);
    showView("comments");
  };
  /** The editors' comment callbacks, stable for their lifetime. */
  const latestStartDraft = useRef(startDraft);
  latestStartDraft.current = startDraft;
  const latestSelect = useRef((id: number) => {
    const thread = threads?.find((th) => th.id === id);
    if (thread) selectThread(thread);
  });
  latestSelect.current = (id: number) => {
    const thread = threads?.find((th) => th.id === id);
    if (thread) selectThread(thread);
  };
  const commentConfigFor = useCallback(
    (path: string): CommentConfig => ({
      onComment: (view) => latestStartDraft.current(path, view),
      onSelect: (id) => latestSelect.current(id),
    }),
    [],
  );
  const aiStatus = useAiStatus(!viaLink);
  const aiAvailable =
    !readOnly &&
    !viaLink &&
    (aiStatus.data?.enabled ?? false) &&
    (aiStatus.data?.allowed ?? false);

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

  // The file drawer makes way for the file it opened.
  useEffect(() => setShowFiles(false), [ws.active]);
  useEffect(() => {
    if (!showFiles) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFiles(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFiles]);

  // Ask before leaving with unsaved changes.
  const hasUnsaved = ws.dirty.size > 0;
  const blocker = useBlocker(hasUnsaved);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    setChoice({
      title: t("editor.actions.leaveTitle"),
      description: t("editor.actions.leaveDescription", {
        count: ws.dirty.size,
      }),
      choices: [
        {
          label: t("editor.actions.leave"),
          variant: "destructive",
          run: async () => {
            // Given up: no draft brings the text back next time.
            await ws.discardDrafts();
            blocker.proceed();
          },
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

  // Unsaved text from before (see drafts.ts) opens again.
  useEffect(() => {
    if (!readOnly) void ws.restoreDrafts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: a pause in typing, or leaving the browser tab, saves the
  // open files in one commit, so a writing session makes a few commits
  // rather than one per keystroke. A file whose visual editor holds
  // something invalid waits to be fixed. A save that failed (a conflict
  // asks what to do) pauses auto-save until the next save by hand.
  const autoSavePaused = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoSaving = useRef(false);
  const runAutoSave = useRef(async () => {});
  runAutoSave.current = async () => {
    clearTimeout(autoSaveTimer.current);
    if (readOnly || !settings.autoSave || autoSavePaused.current) return;
    // A question is open (a conflict, a rename): later.
    if (autoSaving.current || choice || refactor) return scheduleAutoSave();
    const paths = ws
      .currentTabs()
      .filter((tab) => {
        if (!isDirty(tab)) return false;
        const kind = visualKind(tab.path);
        return !(kind && visualProblem(kind, tab.text!));
      })
      .map((tab) => tab.path);
    if (paths.length === 0) return;
    autoSaving.current = true;
    try {
      if (!(await save(paths))) autoSavePaused.current = true;
    } finally {
      autoSaving.current = false;
    }
  };
  const scheduleAutoSave = () => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(
      () => void runAutoSave.current(),
      AUTO_SAVE_DELAY,
    );
  };
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState === "hidden") void runAutoSave.current();
    };
    document.addEventListener("visibilitychange", leave);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      clearTimeout(autoSaveTimer.current);
    };
  }, []);
  /** Typed: the file's draft is kept and auto-save waits for a pause. */
  const changeText = (path: string, text: string) => {
    ws.setText(path, text);
    if (settings.autoSave) scheduleAutoSave();
  };
  /** Saved by hand: auto-save goes on, if a failure paused it. */
  const saveByHand = async (paths: string[]) => {
    const ok = await save(paths);
    if (ok) autoSavePaused.current = false;
    return ok;
  };

  // Ctrl/Cmd+S saves the open file wherever the focus is, not just in its
  // editor, instead of the browser saving the page.
  const saveActive = useRef(() => {});
  saveActive.current = () => {
    if (ws.active && !readOnly) void saveByHand([ws.active]);
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

  // Ctrl/Cmd+Shift+F searches the whole book, starting from the selection.
  const openSearch = useRef(() => {});
  openSearch.current = () => {
    const view = ws.active ? views.get(ws.active) : undefined;
    const selection = view?.state.selection.main;
    setSidebarView("search");
    setSidebarFolded(false);
    if (narrow) setShowFiles(true);
    setSearchFocus((request) => ({
      count: request.count + 1,
      text:
        view && selection && !selection.empty
          ? view.state.sliceDoc(selection.from, selection.to)
          : "",
    }));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "f" ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        !e.shiftKey
      )
        return;
      e.preventDefault();
      openSearch.current();
    };
    // Before the editors, which would read it as their own search.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // A chosen search result: its file opens, and once its editor is there,
  // the match is selected. Typing since the search may have moved it, so the
  // match nearest to where it was is taken.
  useEffect(() => {
    if (!reveal) return;
    if (ws.active !== reveal.path) return;
    const view = views.get(reveal.path);
    if (!view) return;
    setReveal(null);
    const re = compileQuery(reveal.query);
    if (!re) return;
    const { matches } = findMatches(view.state.doc.toString(), re);
    const nearest = matches.reduce<SearchMatch | null>(
      (best, m) =>
        best === null ||
        Math.abs(m.from - reveal.match.from) <
          Math.abs(best.from - reveal.match.from)
          ? m
          : best,
      null,
    );
    if (!nearest) {
      toast.info(t("editor.search.changedMeanwhile"));
      return;
    }
    view.dispatch({
      selection: { anchor: nearest.from, head: nearest.to },
      effects: EditorView.scrollIntoView(nearest.from, { y: "center" }),
    });
    view.focus();
  }, [reveal, viewsVersion, ws.active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd+Alt+A toggles the AI assistant's pane, when this teacher may
  // use it. The latest answer is read at keypress time, not on every render.
  const toggleAi = useRef(() => {});
  toggleAi.current = () => {
    if (aiAvailable) toggleView("ai");
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
    toast.error(
      error instanceof Error ? error.message : t("common.somethingWrong"),
    );

  // The book-wide search (search-panel.tsx).
  const searchTexts = useBookTexts(
    bookId,
    listing.commit,
    sidebarView === "search",
  );
  /** The open tabs' current texts; an element file's base64 is no text to search. */
  const openTexts = useCallback(
    () =>
      ws
        .currentTabs()
        .filter(
          (tab) =>
            tab.status === "ready" &&
            tab.loaded?.kind === "text" &&
            !tab.loaded.encoding &&
            tab.text !== undefined,
        )
        .map((tab) => ({ path: tab.path, text: tab.text! })),
    [ws.currentTabs], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const revealMatch = useCallback(
    (path: string, match: SearchMatch, query: SearchQuery) => {
      ws.open(path);
      setReveal({ path, match, query });
    },
    [ws.open], // eslint-disable-line react-hooks/exhaustive-deps
  );
  /**
   * Replaces every match in the book. A file open in a code editor changes
   * there, unsaved and undoable; the others are saved in one commit.
   */
  const replaceInBook = async (query: SearchQuery, replacement: string) => {
    try {
      const saved = searchTexts.data ?? (await searchTexts.refetch()).data;
      if (!saved) throw new Error(t("editor.search.loadFailed"));
      let count = 0;
      /** Open files: changed in their editor, or left out. */
      const handled = new Set<string>();
      const reloads: string[] = [];
      for (const tab of ws.currentTabs()) {
        if (
          tab.status !== "ready" ||
          tab.loaded?.kind !== "text" ||
          tab.loaded.encoding ||
          tab.text === undefined
        )
          continue;
        const view = views.get(tab.path);
        if (view) {
          handled.add(tab.path);
          const changes = replacements(
            view.state.doc.toString(),
            query,
            replacement,
          );
          if (changes.length === 0) continue;
          view.dispatch({ changes, userEvent: "input.replace" });
          count += changes.length;
        } else if (isDirty(tab)) {
          // A visual editor's unsaved changes: not overwritten.
          handled.add(tab.path);
          if (replacements(tab.text, query, replacement).length > 0)
            toast.warning(t("editor.search.replaceSkipped", { path: tab.path }));
        } else {
          reloads.push(tab.path);
        }
      }
      const writes: Extract<FileChange, { op: "write" }>[] = [];
      for (const file of saved.files) {
        if (handled.has(file.path)) continue;
        const next = replaceAll(file.text, query, replacement);
        if (next.count === 0) continue;
        count += next.count;
        writes.push({
          op: "write",
          path: file.path,
          content: next.text,
          baseOid: file.oid,
        });
      }
      if (writes.length > 0) {
        await ws.commit(
          writes,
          t("editor.search.commitMessage", {
            pattern: query.pattern,
            replacement,
          }),
        );
        const written = new Set(writes.map((w) => w.path));
        for (const path of reloads) if (written.has(path)) void ws.reload(path);
      }
      toast.success(t("editor.search.replaced", { count }));
    } catch (error) {
      failCommit(error);
    }
  };
  const confirmReplace = useCallback(
    (query: SearchQuery, replacement: string, result: SearchResult) =>
      setChoice({
        title: t("editor.search.replaceTitle"),
        description: `${t("editor.search.replaceDescription", {
          count: result.total,
          files: result.files.length,
          pattern: query.pattern,
          replacement,
        })} ${t("editor.search.replaceHow")}`,
        choices: [
          {
            label: t("editor.search.replaceAll"),
            run: () => void replaceInBookRef.current(query, replacement),
          },
        ],
      }),
    [t],
  );
  const replaceInBookRef = useRef(replaceInBook);
  replaceInBookRef.current = replaceInBook;

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
  /** Saves `paths`; false when anything kept them from being saved. */
  const save = async (paths: string[]): Promise<boolean> => {
    for (const tab of ws
      .currentTabs()
      .filter((t) => paths.includes(t.path) && isDirty(t))) {
      const kind = visualKind(tab.path);
      const problem = kind && visualProblem(kind, tab.text!);
      if (problem) {
        fail(
          new Error(
            t("editor.actions.savedProblem", { path: tab.path, problem }),
          ),
        );
        return false;
      }
    }
    try {
      const result = await ws.save(paths);
      for (const { path, oid } of result?.saved ?? []) {
        const view = views.get(path);
        if (!view) continue;
        const anchors = currentAnchors(view);
        rebaseComments(view, oid);
        // Where the threads went while typing: the server cannot tell
        // when their own text was edited.
        if (anchors.length > 0 && canEdit)
          void unwrap(
            api.books[":id"].comments.anchors.$post({
              param: { id: bookId },
              json: { path, oid, anchors },
            }),
          )
            .then(() =>
              queryClient.invalidateQueries({ queryKey: threadsKey(bookId) }),
            )
            .catch(() => {});
      }
      return true;
    } catch (error) {
      if (!(error instanceof ConflictError)) {
        fail(error);
        return false;
      }
      const conflicts = error.paths;
      const current = await fetchListing(bookId);
      const oid = (p: string) =>
        current.files.find((f) => f.path === p)?.oid ?? null;
      setChoice({
        title: t("editor.actions.conflictTitle"),
        description: (
          <>
            <p>{t("editor.actions.conflictIntro")}</p>
            <PathList paths={conflicts} />
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
      return false;
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
        ? new Error(t("editor.actions.existsAlready", { path: error.paths[0] }))
        : error;
    });
    if (open) ws.open(open);
  };

  /** A hyperbook.json for a book without one, so it can render; then its settings. */
  const createConfig = async () => {
    const language = i18n.language.split("-")[0] || "en";
    await commitAndOpen([
      {
        op: "write",
        path: "hyperbook.json",
        content: JSON.stringify({ name: book.title, language }, null, 2) + "\n",
        encoding: "utf8",
        baseOid: null,
      },
    ]);
    toast.success(t("editor.preview.configCreated"));
    setShowSettings(true);
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
  const commitMoves = async (
    moves: Map<string, string>,
    writes: FileChange[] = [],
    message?: string,
  ) => {
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
      writes.push({
        op: "write",
        path: file,
        content: text,
        baseOid: info.oid,
      });
    }
    return writes;
  };

  /** Moves the files in `moves`, asking first when something references them. */
  const moveWithReferences = async (
    froms: string[],
    moves: Map<string, string>,
    kind: "rename" | "move",
  ) => {
    const label = t(
      kind === "rename" ? "editor.files.rename" : "editor.files.move",
    );
    const from = nameOf(froms);
    let scanned: ReferencesResult;
    try {
      scanned = await scanReferences(froms);
    } catch (error) {
      return fail(error);
    }
    if (scanned.references.length === 0)
      return commitMoves(moves).catch(failCommit);
    // Unsaved changes in a referencing page cannot be rewritten safely.
    const dirty = scanned.files
      .filter((f) => ws.dirty.has(f.path))
      .map((f) => f.path);
    if (dirty.length > 0) {
      toast.error(
        t("editor.actions.saveFirstReferencing", { path: dirty[0], from }),
      );
      return;
    }
    const texts = Object.fromEntries(
      scanned.files.map((f) => [f.path, f.text]),
    );
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
                if (ws.tabs.some((t) => t.path === w.path))
                  void ws.reload(w.path);
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

  /** What a list of files and folders is called in a question: its path, or "3 items". */
  const nameOf = (paths: string[]) =>
    paths.length === 1 ? paths[0]! : t("editor.files.items", { count: paths.length });

  /** Where any of `paths` is referenced from, in one result. */
  const scanReferences = async (paths: string[]): Promise<ReferencesResult> => {
    const scans = await Promise.all(paths.map((p) => fetchReferences(bookId, p)));
    const files = new Map<string, ReferencesResult["files"][number]>();
    for (const scan of scans) for (const f of scan.files) files.set(f.path, f);
    return { references: scans.flatMap((scan) => scan.references), files: [...files.values()] };
  };

  /** Every file of the book that `nodes` are or hold. */
  const filesOf = (nodes: NodeRef[]) =>
    nodes.flatMap((n) => (n.isFolder ? filesIn(n.path) : [n.path]));

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

  /** Files dropped or pasted into a page: uploaded next to it and linked; files from the tree linked. */
  const dropInto = (page: string): DropHandler => ({
    files: (view, dropped, from, to) => {
      const planned = new Set<string>();
      const taken = (p: string) =>
        planned.has(p) || listing.files.some((f) => f.path === p);
      const picks = dropped.map((file) => {
        const path = dropPath(page, file.name, taken);
        planned.add(path);
        return { file, path };
      });
      const text = picks
        .map(({ path }) => linkTo(page, path) ?? path)
        .join("\n");
      // The link goes in at once; the picture follows when uploaded.
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        userEvent: "input.paste",
      });
      view.focus();
      void (async () => {
        try {
          const changes: FileChange[] = await Promise.all(
            picks.map(async ({ file, path }) => ({
              op: "write" as const,
              path,
              encoding: "base64" as const,
              content: toBase64(new Uint8Array(await file.arrayBuffer())),
              baseOid: null,
            })),
          );
          await ws.commit(changes);
          toast.success(
            picks.length === 1
              ? t("editor.actions.uploadedToast_one", { name: picks[0]!.path.split("/").pop() })
              : t("editor.actions.uploadedToast_other", { count: picks.length }),
          );
        } catch (error) {
          fail(error);
        }
      })();
    },
    nodes: (view, nodes, from, to) => {
      const text = nodes
        .filter((n) => !n.isFolder)
        .flatMap((n) => linkTo(page, n.path) ?? [])
        .join("\n");
      if (!text) return;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        userEvent: "input.drop",
      });
      view.focus();
    },
  });
  const latestDrop = useRef(dropInto);
  latestDrop.current = dropInto;

  const actions = {
    open: ws.open,
    download: (path: string) => {
      const a = document.createElement("a");
      a.href = rawUrl(bookId, path);
      a.download = path.split("/").pop()!;
      a.click();
    },
    create: async (path: string, isFolder: boolean) => {
      // A folder exists through its files, so it starts with its index page.
      const file = isFolder ? `${path}/index.md` : path;
      await commitAndOpen(
        [
          {
            op: "write",
            path: file,
            content: starter(file, bookLanguage),
            encoding: starterEncoding(file),
            baseOid: null,
          },
        ],
        file,
      );
    },
    pickUpload: (folder: string) => {
      uploadFolder.current = folder;
      replaceTarget.current = null;
      uploadInput.current?.click();
    },
    upload: (folder: string, files: File[]) => void upload(folder, files),
    canRename: (path: string, isFolder: boolean) =>
      !busyFiles(isFolder ? filesIn(path) : [path]),
    // Only the name: moving is dragging, or Cut and Paste.
    rename: (from: string, to: string, isFolder: boolean) => {
      const affected = isFolder ? filesIn(from) : [from];
      if (from === to || busyFiles(affected)) return;
      const moves = new Map(
        affected.map((p) => [p, to + p.slice(from.length)]),
      );
      void moveWithReferences([from], moves, "rename");
    },
    remove: (picked: NodeRef[]) => {
      const nodes = outermost(picked);
      if (nodes.length === 0) return;
      const affected = filesOf(nodes);
      const name = nameOf(nodes.map((n) => n.path));
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
          scanned = await scanReferences(nodes.map((n) => n.path));
        } catch (error) {
          return fail(error);
        }
        const base =
          nodes.length === 1 && !nodes[0]!.isFolder
            ? t("editor.actions.deleteFileDescription")
            : t("editor.actions.deleteFolderDescription", {
                count: affected.length,
              });
        if (scanned.references.length === 0)
          return setChoice({
            title: t("editor.actions.deleteTitle", { path: name }),
            description: (
              <>
                {nodes.length > 1 && <PathList paths={nodes.map((n) => n.path)} />}
                <p>{base}</p>
              </>
            ),
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
          title: t("editor.actions.deleteTitle", { path: name }),
          lead: (
            <p>
              {base} {lead}
            </p>
          ),
          references: scanned.references,
          texts: Object.fromEntries(scanned.files.map((f) => [f.path, f.text])),
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
    move: (picked: NodeRef[], to: string) => {
      const nodes = outermost(picked).filter((n) => {
        const name = n.path.split("/").pop()!;
        return join(to, name) !== n.path; // Dropped where it already is.
      });
      if (nodes.length === 0) return;
      if (nodes.some((n) => n.isFolder && (to === n.path || to.startsWith(n.path + "/"))))
        return toast.error(t("editor.actions.folderIntoItself"));
      const moves = new Map<string, string>();
      for (const n of nodes) {
        const dest = join(to, n.path.split("/").pop()!);
        for (const p of n.isFolder ? filesIn(n.path) : [n.path])
          moves.set(p, dest + p.slice(n.path.length));
      }
      if (moves.size === 0 || busyFiles([...moves.keys()])) return;
      void moveWithReferences(nodes.map((n) => n.path), moves, "move");
    },
    copy: (nodes: NodeRef[]) =>
      setTreeClipboard({ nodes: outermost(nodes), cut: false }),
    cut: (nodes: NodeRef[]) =>
      setTreeClipboard({ nodes: outermost(nodes), cut: true }),
    paste: async (folder: string) => {
      const clip = treeClipboard;
      if (!clip) return;
      if (clip.cut) {
        // Cut once, pasted once: the files are gone from where they were.
        setTreeClipboard(null);
        return actions.move(clip.nodes, folder);
      }
      const affected = filesOf(clip.nodes);
      if (affected.length === 0)
        return toast.error(t("editor.actions.gone", { path: nameOf(clip.nodes.map((n) => n.path)) }));
      if (busyFiles(affected)) return;
      // Next to the original, or anywhere its name is taken, a copy's name.
      const planned = new Set<string>();
      const taken = (p: string) =>
        planned.has(p) ||
        listing.files.some((f) => f.path === p || f.path.startsWith(p + "/"));
      const dests = clip.nodes.map((n) => {
        let dest = join(folder, n.path.split("/").pop()!);
        if (taken(dest)) dest = copyName(dest, taken);
        planned.add(dest);
        return dest;
      });
      try {
        const changes = (
          await Promise.all(
            clip.nodes.map((n, i) =>
              Promise.all(
                (n.isFolder ? filesIn(n.path) : [n.path]).map(
                  async (from): Promise<FileChange> => {
                    const res = await fetch(rawUrl(bookId, from));
                    if (!res.ok)
                      throw new Error(t("editor.actions.couldNotCopy", { path: from }));
                    return {
                      op: "write",
                      path: dests[i]! + from.slice(n.path.length),
                      encoding: "base64",
                      content: toBase64(new Uint8Array(await res.arrayBuffer())),
                      baseOid: null,
                    };
                  },
                ),
              ),
            ),
          )
        ).flat();
        const single = clip.nodes.length === 1 && !clip.nodes[0]!.isFolder;
        await commitAndOpen(changes, single ? dests[0] : undefined);
      } catch (error) {
        fail(error);
      }
    },
  };

  // The file tree's actions: `actions` is rebuilt every render with new
  // closures, but the tree memoizes on its props, so it gets stable ones
  // that forward to whatever `actions` currently is.
  const latestActions = useRef(actions);
  latestActions.current = actions;
  const treeActions = useMemo<TreeActions>(
    () => ({
      open: (path) => latestActions.current.open(path),
      create: (path, isFolder) => latestActions.current.create(path, isFolder),
      upload: (folder, files) => latestActions.current.upload(folder, files),
      pickUpload: (folder) => latestActions.current.pickUpload(folder),
      canRename: (path, isFolder) =>
        latestActions.current.canRename(path, isFolder),
      rename: (from, to, isFolder) =>
        latestActions.current.rename(from, to, isFolder),
      remove: (nodes) => latestActions.current.remove(nodes),
      download: (path) => latestActions.current.download(path),
      move: (nodes, to) => latestActions.current.move(nodes, to),
      copy: (nodes) => latestActions.current.copy(nodes),
      cut: (nodes) => latestActions.current.cut(nodes),
      paste: (folder) => latestActions.current.paste(folder),
    }),
    [],
  );

  /**
   * Closes `paths`; when any of them has unsaved changes, asks first whether
   * to save them or to close without saving.
   */
  const closeTabs = (paths: string[]) => {
    const closing = ws.currentTabs().filter((t) => paths.includes(t.path));
    const dirty = closing.filter(isDirty);
    const doClose = () => paths.forEach((path) => ws.close(path));
    if (dirty.length === 0) return doClose();
    setChoice({
      title:
        paths.length === 1
          ? t("editor.actions.closeTitle", { path: paths[0] })
          : t("editor.actions.closeManyTitle"),
      description:
        paths.length === 1 ? (
          t("editor.actions.closeDescription")
        ) : (
          <>
            <p>
              {t("editor.actions.closeManyDescription", { count: dirty.length })}
            </p>
            <PathList paths={dirty.map((tab) => tab.path)} />
          </>
        ),
      choices: [
        {
          label: t("editor.actions.closeWithoutSaving"),
          variant: "destructive",
          run: doClose,
        },
        {
          label: t("editor.actions.saveAndClose"),
          run: async () => {
            // A failed save or a conflict keeps the tabs and their edits.
            if (await save(dirty.map((t) => t.path))) doClose();
          },
        },
      ],
    });
  };

  /** The tab's context menu: close it, the others, or all of them. */
  const tabMenu = (event: React.MouseEvent, tab: Tab) => {
    event.preventDefault();
    event.stopPropagation();
    ws.setActive(tab.path);
    // The tabs as they are on click: one may open while the menu is up.
    const all = () => ws.currentTabs().map((t) => t.path);
    const { x, y } = menuPoint(event.nativeEvent);
    openMenu(x, y, (box) => {
      item(box, t("editor.tabs.close", { path: tab.path }), () =>
        closeTabs([tab.path]),
      );
      item(
        box,
        t("editor.tabs.closeOthers"),
        () => closeTabs(all().filter((path) => path !== tab.path)),
        { disabled: ws.tabs.length <= 1 },
      );
      separator(box);
      item(box, t("editor.tabs.closeAll"), () => closeTabs(all()));
    }, { focusFirst: fromKeyboard(event.nativeEvent) });
  };

  /**
   * The tabs from the keyboard, as tab lists go: the arrows, Home and End
   * move between them, Delete closes one.
   */
  const tabKeys = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const paths = ws.tabs.map((tab) => tab.path);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % paths.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + paths.length) % paths.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = paths.length - 1;
        break;
      case "Delete":
        event.preventDefault();
        closeTabs([paths[index]!]);
        return;
      default:
        return;
    }
    event.preventDefault();
    ws.setActive(paths[next]!);
    document.getElementById(`editor-tab-${next}`)?.focus();
  };

  const activeTab = ws.tabs.find((t) => t.path === ws.active);
  const openBookSettings = () => {
    if (!busyFiles(["hyperbook.json"])) setShowSettings(true);
  };
  /** A side pane on a compact screen: over the editor, from the right. */
  const overlay =
    "absolute inset-y-0 right-0 z-20 w-full border-l border-border shadow-lg sm:w-[min(100%,36rem)]";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-sidebar px-2 py-2 sm:gap-2 sm:px-3">
        {narrow && (
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={
              showFiles
                ? t("editor.toolbar.hideFiles")
                : t("editor.toolbar.showFiles")
            }
            aria-expanded={showFiles}
            aria-controls="editor-files"
            onClick={() => setShowFiles((v) => !v)}
          >
            <FolderTreeIcon className="size-4" />
          </Button>
        )}
        <h1 className="sr-only">
          {t("editor.title", { title: book.title })}
        </h1>
        <BackLink book={book} className="min-w-0" />
        {viaLink && <LinkVisitorBadge book={book} />}
        <span className="flex-1" />
        {!readOnly && (
          <>
          <Button
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            disabled={!exists("hyperbook.json")}
            onClick={openBookSettings}
          >
            {t("editor.toolbar.bookSettings")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="max-sm:px-2"
                disabled={!hasUnsaved}
              >
                <SaveIcon className="size-3.5 sm:hidden" aria-hidden />
                <span className="max-sm:sr-only">
                  {t("editor.toolbar.saveAll")}
                </span>
                <ChevronDownIcon className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                {t("editor.toolbar.unsavedFiles")}
              </DropdownMenuLabel>
              {[...ws.dirty].map((path) => (
                <DropdownMenuItem
                  key={path}
                  className="gap-2"
                  onSelect={() => ws.setActive(path)}
                >
                  <span
                    className="size-2 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span className="truncate font-mono text-xs">{path}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void saveByHand([...ws.dirty])}>
                {t("editor.toolbar.saveAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EditorPublishButton
            book={book}
            commit={listing.commit}
            unsaved={hasUnsaved}
          />
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={
            showPreview
              ? t("editor.toolbar.hidePreview")
              : t("editor.toolbar.showPreview")
          }
          aria-pressed={showPreview}
          onClick={() => togglePane("preview")}
        >
          <PanelRightIcon className="size-4" />
        </Button>
        {/* What a phone's header has no room for, and quick open without Ctrl+P. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 sm:hidden"
              aria-label={t("editor.toolbar.more")}
            >
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            // The dialogs opened from here keep the focus.
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem onSelect={() => setQuickOpen(true)}>
              <SearchIcon /> {t("editor.toolbar.findFile")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openSearch.current()}>
              <SearchIcon /> {t("editor.toolbar.searchBook")}
            </DropdownMenuItem>
            {!readOnly && (
              <DropdownMenuItem
                disabled={!exists("hyperbook.json")}
                onSelect={openBookSettings}
              >
                <BookIcon /> {t("editor.toolbar.bookSettings")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTheme(theme === "dark" ? "light" : "dark");
              }}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <LinkWelcome book={book} />

      <div className="relative flex min-h-0 flex-1">
        {narrow && showFiles && (
          <div
            className="absolute inset-0 z-30 bg-black/40"
            onClick={() => setShowFiles(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          id="editor-files"
          className={cn(
            "flex w-72 shrink-0 bg-sidebar",
            sidebarFolded && !narrow && "w-auto",
            narrow &&
              "absolute inset-y-0 left-0 z-40 w-80 max-w-[85vw] shadow-lg transition-[translate,visibility]",
            narrow && !showFiles && "invisible -translate-x-full",
          )}
          style={
            sidebarWidth === null || narrow || sidebarFolded
              ? undefined
              : { width: sidebarWidth }
          }
        >
          {/* The activity bar: which view the sidebar shows. Choosing the
              shown one again folds the sidebar down to the bar. */}
          <div
            role="tablist"
            aria-label={t("editor.toolbar.sidebar")}
            aria-orientation="vertical"
            className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border py-2 pointer-coarse:w-13"
          >
            {SIDEBAR_VIEWS.filter((view) => view !== "ai" || aiAvailable).map(
              (view) => {
                const { label, Icon } = sidebarItems[view];
                const shown = sidebarView === view && sidebarOpen;
                return (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-label={t(label)}
                    title={
                      view === "search"
                        ? `${t(label)} (${t("editor.search.shortcut")})`
                        : t(label)
                    }
                    aria-selected={shown}
                    aria-controls="editor-sidebar-panel"
                    className={cn(
                      "relative flex size-9 shrink-0 items-center justify-center rounded-md pointer-coarse:size-11",
                      shown
                        ? "bg-accent text-primary before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() =>
                      view === "search" && !shown
                        ? openSearch.current()
                        : toggleView(view)
                    }
                  >
                    <Icon className="size-5" aria-hidden />
                    {view === "comments" && commentCounts.size > 0 && (
                      <span
                        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-500"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              },
            )}
            <span className="flex-1" />
            <SettingsMenu
              settings={settings}
              update={updateSettings}
              canSpellCheck={canSpellCheck && !readOnly}
              onOpenWords={() => setShowWords(true)}
              side="right"
              triggerClassName="size-9 text-muted-foreground pointer-coarse:size-11"
            />
            <ThemeToggle className="size-9 text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:size-11 [&_svg]:size-5" />
          </div>
          <div
            id="editor-sidebar-panel"
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              sidebarFolded && !narrow && "hidden",
            )}
          >
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              sidebarView !== "files" && "hidden",
            )}
          >
            <FileSidebar
              files={listing.files}
              active={ws.active}
              dirty={ws.dirty}
              actions={treeActions}
              clipboard={treeClipboard}
              readOnly={readOnly}
              comments={commentCounts}
            />
          </div>
          {/* Kept once opened, so switching back finds the same search. */}
          {(sidebarView === "search" || searchFocus.count > 0) && (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                sidebarView !== "search" && "hidden",
              )}
            >
              <SearchPanel
                texts={searchTexts}
                openTexts={openTexts}
                changeKey={ws.dirty}
                readOnly={readOnly}
                focusRequest={searchFocus}
                onReveal={revealMatch}
                onReplaceAll={confirmReplace}
              />
            </div>
          )}
          {sidebarView === "comments" && (
            <section
              className="flex min-h-0 flex-1 flex-col"
              aria-label={t("editor.toolbar.comments")}
            >
              <CommentsPanel
                bookId={bookId}
                threads={threads ?? []}
                activePath={activeTab?.path ?? null}
                activeThread={activeThread}
                canEdit={canEdit}
                draft={draft}
                onDraftDone={(threadId) => {
                  setDraft(null);
                  if (threadId !== null) setActiveThread(threadId);
                }}
                onSelect={selectThread}
                onApply={(thread, comment) => {
                  const view = views.get(thread.path);
                  return (
                    !!view &&
                    applySuggestion(
                      view,
                      thread.id,
                      thread.quote,
                      comment.suggestion ?? "",
                    )
                  );
                }}
              />
            </section>
          )}
          {sidebarView === "history" && (
            <section
              className="flex min-h-0 flex-1 flex-col"
              aria-label={t("editor.toolbar.history")}
            >
              <HistoryPanel
                bookId={bookId}
                activePath={activeTab?.path ?? null}
                commit={listing.commit}
              />
            </section>
          )}
          {sidebarView === "ai" && aiAvailable && (
            <section
              className="flex min-h-0 flex-1 flex-col"
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
          )}
          {sidebarView === "outline" && (
            <OutlinePanel
              path={ws.active}
              view={ws.active ? views.get(ws.active) : undefined}
              active={!sidebarFolded && (!narrow || showFiles)}
              onChosen={() => setShowFiles(false)}
            />
          )}
          </div>
        </aside>
        {!narrow && !sidebarFolded && (
          <Splitter
            label={t("editor.toolbar.resizeFiles")}
            pane={sidebarRef}
            direction={1}
            onResize={setSidebarWidth}
            onReset={() => setSidebarWidth(null)}
            className="bg-sidebar-border"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col">
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
          <div
            role="tablist"
            className="flex shrink-0 overflow-x-auto border-b border-border"
          >
            {ws.tabs.map((tab, index) => (
              <div
                key={tab.path}
                className={cn(
                  "group flex shrink-0 items-center border-r border-border text-sm",
                  tab.path === ws.active
                    ? "bg-background font-medium text-primary"
                    : "bg-sidebar text-muted-foreground",
                )}
                onContextMenu={(event) => tabMenu(event, tab)}
              >
                <button
                  type="button"
                  role="tab"
                  id={`editor-tab-${index}`}
                  aria-controls={`editor-panel-${index}`}
                  aria-selected={tab.path === ws.active}
                  tabIndex={tab.path === ws.active ? 0 : -1}
                  title={tab.path}
                  className="py-1.5 pr-1 pl-3 pointer-coarse:py-2.5"
                  onClick={() => ws.setActive(tab.path)}
                  onKeyDown={(event) => tabKeys(event, index)}
                >
                  {tab.path.split("/").pop()}
                  {isDirty(tab) && (
                    <span
                      className="ml-1.5 inline-block size-2 rounded-full bg-primary"
                      title={t("editor.files.notSaved")}
                    >
                      <span className="sr-only">{t("editor.files.notSaved")}</span>
                    </span>
                  )}
                </button>
                {/* For the mouse; the keyboard closes the tab with Delete or its menu. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className="mr-1 rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100 pointer-coarse:p-1.5"
                  aria-label={t("editor.tabs.close", { path: tab.path })}
                  title={t("editor.tabs.close", { path: tab.path })}
                  onClick={() => closeTabs([tab.path])}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            {ws.tabs.map((tab, index) => (
              <div
                key={tab.path}
                role="tabpanel"
                id={`editor-panel-${index}`}
                aria-labelledby={`editor-tab-${index}`}
                className={cn(
                  "absolute inset-0",
                  tab.path !== ws.active && "hidden",
                )}
              >
                <TabContent
                  ws={ws}
                  tab={tab}
                  readOnly={readOnly}
                  files={listing.files.map((f) => f.path)}
                  settings={settings}
                  spell={spell}
                  commentConfig={commentConfigFor(tab.path)}
                  drop={
                    !readOnly && isMarkdownPage(tab.path)
                      ? fileDrop(() => latestDrop.current(tab.path))
                      : []
                  }
                  onView={(path, view) => {
                    if (view) {
                      views.set(path, view);
                      syncThreads(view, latestEditorThreads.current(path));
                    } else views.delete(path);
                    setViewsVersion((v) => v + 1);
                  }}
                  onEditBlock={(block, view) =>
                    editBlock(tab.path, block, view)
                  }
                  onChange={(text) => changeText(tab.path, text)}
                  onSave={() => void saveByHand([tab.path])}
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

        {showPreview && (
          <>
            {!compact && (
              <Splitter
                label={t("editor.toolbar.resizePreview")}
                pane={previewRef}
                direction={-1}
                onResize={setPreviewWidth}
                onReset={() => setPreviewWidth(null)}
              />
            )}
            <section
              ref={previewRef}
              className={cn(
                compact ? overlay : "w-[45%] max-w-3xl shrink-0",
                "bg-background",
              )}
              style={
                previewWidth === null || compact
                  ? undefined
                  : { width: previewWidth, maxWidth: "none" }
              }
              aria-label={t("editor.toolbar.preview")}
            >
              <LivePreview
                ws={ws}
                bookId={bookId}
                missingConfig={!exists("hyperbook.json") && !exists("hyperlibrary.json")}
                onCreateConfig={readOnly ? undefined : createConfig}
                file={
                  activeTab &&
                  pageOf(activeTab.path) &&
                  activeTab.status === "ready"
                    ? activeTab.path
                    : null
                }
                typstFile={
                  // Also while the tab reloads (after an upload or a
                  // conflict): the pane stays, with its last PDF.
                  activeTab &&
                  extension(activeTab.path) === "typ" &&
                  activeTab.status !== "error"
                    ? activeTab.path
                    : null
                }
                onTypstDiagnostics={(path, diagnostics) => {
                  const view = views.get(path);
                  if (view) showTypstDiagnostics(view, path, diagnostics);
                }}
                onTypstJump={(path, click) => {
                  const view = views.get(path);
                  if (!view) return;
                  const at = findInSource(view.state.doc.toString(), click);
                  if (at === null)
                    return void toast.error(
                      t("editor.typstPreview.notFound", { path }),
                    );
                  // The word found, selected.
                  const word =
                    /^[\p{L}\p{N}]+/u.exec(view.state.sliceDoc(at, at + 200))?.[0] ?? "";
                  view.dispatch({
                    selection: { anchor: at, head: at + word.length },
                    effects: EditorView.scrollIntoView(at, { y: "center" }),
                  });
                  view.focus();
                }}
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

      <ChoiceDialog
        request={choice}
        onClose={(closed) => {
          // A choice may have asked a follow-up question; keep that one open.
          setChoice((current) => (current === closed ? null : current));
          if (blocker.state === "blocked") blocker.reset();
        }}
      />
      <RefactorDialog request={refactor} onClose={() => setRefactor(null)} />
      <QuickOpen
        open={quickOpen}
        files={filePaths}
        tabs={tabPaths}
        onClose={closeQuickOpen}
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
  typstFile,
  onTypstDiagnostics,
  onTypstJump,
  ...props
}: {
  ws: Workspace;
  bookId: string;
  file: string | null;
  /** An open `.typ` file: shown as the PDF it compiles to instead. */
  typstFile: string | null;
  onTypstDiagnostics: (path: string, diagnostics: TypstDiagnostic[]) => void;
  onTypstJump: (path: string, click: PdfClick) => void;
  commit: string | null;
  onNavigate: (href: string) => boolean;
  missingConfig: boolean;
  onCreateConfig?: () => Promise<void>;
}) {
  const text = useLiveText(ws, typstFile ?? file);
  if (typstFile !== null) {
    return (
      <TypstPreviewPane
        bookId={props.bookId}
        file={typstFile}
        text={text ?? null}
        onDiagnostics={onTypstDiagnostics}
        onJump={onTypstJump}
      />
    );
  }
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
  readOnly,
  commentConfig,
  drop,
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
  readOnly: boolean;
  /** The file's comment threads in its editor (see comments.ts). */
  commentConfig: CommentConfig;
  /** Files dropped or pasted into the editor (see file-drop.ts). */
  drop: Extension;
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
    const initial = ws.textOf(tab.path)!;
    // The server's thread positions refer to the saved text; an editor that
    // starts from unsaved text finds its threads by their text instead.
    const baseOid =
      normalizeText(initial) === normalizeText(loaded.text) ? loaded.oid : null;
    // Both views start from the current text, so switching keeps unsaved changes.
    const source = (
      <CodeEditor
        key={`${tab.path}:${tab.version}`}
        path={tab.path}
        initial={initial}
        extensions={
          // Base64 of a binary file (a .sb3) has nothing to comment on.
          loaded.encoding
            ? []
            : [commentsExtension(commentConfig, baseOid), drop]
        }
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
        readOnly={readOnly}
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
    // The visual editors change what they show; commenters get the source.
    if (!kind || readOnly) return source;
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
      ) : loaded.kind === "pdf" ? (
        <div className="flex h-[70vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border">
          <PdfView data={loaded.data} className="flex-1" />
        </div>
      ) : (
        <p className="max-w-md text-center text-muted-foreground">
          {extension(tab.path) === "h5p"
            ? t("editor.tabs.h5p")
            : t("editor.tabs.cannotEdit")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {tab.path} · {size}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          {t("editor.tabs.download")}
        </Button>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={onReplace}>
            {t("editor.tabs.replace")}
          </Button>
        )}
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
