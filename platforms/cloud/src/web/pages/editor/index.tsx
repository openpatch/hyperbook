import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, FilePlusIcon, FolderPlusIcon, PanelRightIcon, SettingsIcon, UploadIcon, XIcon } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router";
import { toast } from "sonner";
import type { FileChange } from "../../../shared/schemas";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { type Book, useBook } from "@/lib/books";
import { cn } from "@/lib/utils";
import { LogDialog } from "../publishing";
import { CodeEditor } from "./code-editor";
import { ChoiceDialog, type ChoiceRequest, PathDialog, type PathRequest } from "./dialogs";
import { FileTree } from "./file-tree";
import { type Listing, copyName, extension, fetchListing, pageOf, rawUrl, starter, toBase64 } from "./files";
import { PreviewPane } from "./preview";
import { VisualFrame, visualKind, visualProblem } from "./visual-frame";
import { PublishButton, useBuilds } from "./publish";
import { type Block, type InlineBlock, resolveSrc } from "./blocks";
import { BlockDialog } from "./block-dialog";
import { FILE_ELEMENTS, type FileElement, InsertMenu, insertAtCursor } from "./insert-menu";
import { SettingsDialog } from "./settings-dialog";
import { PageSettingsDialog } from "./page-settings-dialog";
import { withPageForm } from "./frontmatter";
import { ConflictError, type Tab, isDirty, useWorkspace } from "./workspace";

export function Component() {
  const id = useParams().id!;
  const { data: book } = useBook(id);
  const { data: listing } = useQuery({ queryKey: ["books", id, "files"], queryFn: () => fetchListing(id) });
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
  return <div className="mx-auto mt-[15vh] grid max-w-md gap-4 px-4 text-center">{children}</div>;
}

function BackLink({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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
        api.books[":id"].files.init.$post({ param: { id: String(book.id) }, json: { template } }),
      );
      queryClient.setQueryData(["books", String(book.id), "files"], { commit: res.commit, files: res.files });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setBusy(false);
    }
  };
  return (
    <Centered>
      <h1 className="text-2xl">{book.title} has no files yet</h1>
      <p className="text-muted-foreground">Start with a few example pages, or with a single empty page.</p>
      <div className="flex justify-center gap-2">
        <Button disabled={busy} onClick={() => void start("default")}>
          Example pages
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void start("empty")}>
          Empty book
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Have a book already? Upload it as a zip on the <Link to={`/books/${book.id}`} className="text-primary hover:underline">book's page</Link>.
      </p>
    </Centered>
  );
}

const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

function Editor({ book, listing }: { book: Book; listing: Listing }) {
  const bookId = String(book.id);
  const ws = useWorkspace(bookId, listing);
  const { data: builds } = useBuilds(bookId);
  // The book's language: struktolab's keywords depend on it.
  const { data: bookLanguage = "en" } = useQuery({
    queryKey: ["books", bookId, "language", listing.files.find((f) => f.path === "hyperbook.json")?.oid],
    queryFn: async () => (await unwrap(api.books[":id"].files.language.$get({ param: { id: bookId } }))).language,
    placeholderData: (previous) => previous,
  });
  const queryClient = useQueryClient();
  const [pathRequest, setPathRequest] = useState<PathRequest | null>(null);
  const [choice, setChoice] = useState<ChoiceRequest | null>(null);
  const [logFor, setLogFor] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [blockEdit, setBlockEdit] = useState<{ block: InlineBlock; view: EditorView } | null>(null);

  /** "Edit visually" in a page: a structogram in a dialog, an element file in its tab. */
  const editBlock = (page: string, block: Block, view: EditorView) => {
    if (block.type === "inline") return setBlockEdit({ block, view });
    const file = resolveSrc(block.src, page, exists);
    if (file) ws.open(file);
    else toast.error(`${block.src} does not exist in the book.`);
  };

  /** Insert → learning map, drawing, …: a starter file in public/ and its directive in the page. */
  const insertFileElement = (kind: FileElement, view: EditorView) => {
    const element = FILE_ELEMENTS[kind];
    setPathRequest({
      title: `New ${element.label.toLowerCase()}`,
      description: "It is kept in the book's public folder, and the page shows it where the cursor is.",
      label: "Name",
      initial: element.name,
      submitLabel: "Create",
      onSubmit: async (name) => {
        const file = `public/${name.replace(new RegExp(`\\.${kind}$`), "")}.${kind}`;
        await commitAndOpen([{ op: "write", path: file, content: starter(file, bookLanguage), baseOid: null }]);
        insertAtCursor(view, element.directive("/" + file.slice("public/".length)));
        ws.open(file);
      },
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
      choices: [{ label: "Leave", variant: "destructive", run: () => blocker.proceed() }],
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
      if (e.key.toLowerCase() !== "s" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      // The file's editor saved it already.
      if (e.defaultPrevented && (e.target as Element | null)?.closest?.(".cm-editor")) return;
      e.preventDefault();
      saveActive.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : "Something went wrong");

  /** Saves files; a conflict asks what to do. */
  const save = async (paths: string[]) => {
    for (const tab of ws.currentTabs().filter((t) => paths.includes(t.path) && isDirty(t))) {
      const kind = visualKind(tab.path);
      const problem = kind && visualProblem(kind, tab.text!);
      if (problem) return fail(new Error(`${tab.path} was not saved. ${problem}`));
    }
    try {
      await ws.save(paths);
    } catch (error) {
      if (!(error instanceof ConflictError)) return fail(error);
      const conflicts = error.paths;
      const current = await fetchListing(bookId);
      const oid = (p: string) => current.files.find((f) => f.path === p)?.oid ?? null;
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
            <p>Keep your version as a copy, replace theirs with yours, or drop your changes.</p>
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
              const taken = (p: string) => current.files.some((f) => f.path === p);
              const tabs = ws.tabs.filter((t) => conflicts.includes(t.path));
              try {
                await ws.commit(
                  tabs.map((t) => ({ op: "write", path: copyName(t.path, taken), content: t.text!, baseOid: null })),
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
                await ws.save(paths, Object.fromEntries(conflicts.map((p) => [p, oid(p)])));
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

  const filesIn = (folder: string) => listing.files.filter((f) => f.path.startsWith(folder + "/")).map((f) => f.path);

  const commitAndOpen = async (changes: FileChange[], open?: string) => {
    await ws.commit(changes).catch((error) => {
      throw error instanceof ConflictError ? new Error(`${error.paths[0]} exists already`) : error;
    });
    if (open) ws.open(open);
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
      for (const ch of changes) if (ws.tabs.some((t) => t.path === ch.path)) void ws.reload(ch.path);
      toast.success(files.length === 1 ? `Uploaded ${files[0]!.name}` : `Uploaded ${files.length} files`);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  // Insert → H5P content: the page the .h5p goes into, while the file is chosen.
  const h5pInput = useRef<HTMLInputElement>(null);
  const h5pView = useRef<EditorView | null>(null);
  const insertH5P = (view: EditorView) => {
    h5pView.current = view;
    h5pInput.current?.click();
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
        onSubmit: (path) => commitAndOpen([{ op: "write", path, content: starter(path), baseOid: null }], path),
      }),
    newFolder: (folder: string) =>
      setPathRequest({
        title: "New folder",
        description: "A folder exists through its files, so it starts with an index.md page.",
        label: "Folder",
        initial: join(folder, "chapter"),
        submitLabel: "Create",
        onSubmit: (path) => {
          const index = `${path}/index.md`;
          return commitAndOpen([{ op: "write", path: index, content: starter(index), baseOid: null }], index);
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
      setPathRequest({
        title: isFolder ? "Rename or move folder" : "Rename or move file",
        label: "New path",
        initial: path,
        submitLabel: "Rename",
        onSubmit: async (to) => {
          if (to === path) return;
          const moves = new Map(affected.map((p) => [p, to + p.slice(path.length)]));
          await commitAndOpen(
            [...moves].map(([from, dest]) => ({ op: "move", from, to: dest, baseOid: ws.oidOf(from)! })),
          );
          ws.renameTabs(moves);
        },
      });
    },
    remove: (path: string, isFolder: boolean) => {
      const affected = isFolder ? filesIn(path) : [path];
      setChoice({
        title: `Delete ${path}?`,
        description: isFolder
          ? `This deletes the folder and its ${affected.length} file(s). Older versions stay in the book's history.`
          : "Older versions stay in the book's history.",
        choices: [
          {
            label: "Delete",
            variant: "destructive",
            run: async () => {
              try {
                await ws.commit(affected.map((p) => ({ op: "delete", path: p, baseOid: ws.oidOf(p)! })));
                for (const p of affected) ws.close(p);
              } catch (error) {
                fail(error instanceof ConflictError ? new Error("Someone else changed these files; try again.") : error);
              }
            },
          },
        ],
      });
    },
  };

  const closeTab = (tab: Tab) => {
    if (!isDirty(tab)) return ws.close(tab.path);
    setChoice({
      title: `Close ${tab.path}?`,
      description: "Your changes to this file are not saved.",
      choices: [
        { label: "Close without saving", variant: "destructive", run: () => ws.close(tab.path) },
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
        <Button size="sm" variant="outline" disabled={!hasUnsaved} onClick={() => void save([...ws.dirty])}>
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
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-1 border-b border-sidebar-border px-2 py-1">
            <span className="flex-1 text-sm font-medium">Files</span>
            <Button variant="ghost" size="icon" className="size-7" aria-label="New file" onClick={() => actions.newFile(ws.active ? parentOf(ws.active) : "book")}>
              <FilePlusIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label="New folder" onClick={() => actions.newFolder(ws.active ? parentOf(ws.active) : "book")}>
              <FolderPlusIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Upload files" onClick={() => actions.pickUpload(ws.active ? parentOf(ws.active) : "book")}>
              <UploadIcon className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <FileTree files={listing.files} active={ws.active} dirty={ws.dirty} actions={actions} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div role="tablist" className="flex shrink-0 overflow-x-auto border-b border-border">
            {ws.tabs.map((tab) => (
              <div
                key={tab.path}
                className={cn(
                  "group flex shrink-0 items-center border-r border-border text-sm",
                  tab.path === ws.active ? "bg-background font-medium text-primary" : "bg-sidebar text-muted-foreground",
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
                  {isDirty(tab) && <span className="ml-1.5 inline-block size-2 rounded-full bg-primary" title="Not saved" />}
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
              <div key={tab.path} className={cn("absolute inset-0", tab.path !== ws.active && "hidden")}>
                <TabContent
                  tab={tab}
                  files={listing.files.map((f) => f.path)}
                  onEditBlock={(block, view) => editBlock(tab.path, block, view)}
                  onInsertFile={insertFileElement}
                  onInsertH5P={insertH5P}
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
              <p className="p-8 text-center text-muted-foreground">Open a file from the list on the left.</p>
            )}
          </div>
        </main>

        {showPreview && (
          <section className="hidden w-[45%] max-w-3xl shrink-0 border-l border-border lg:block" aria-label="Preview">
            <PreviewPane
              bookId={bookId}
              file={activeTab && pageOf(activeTab.path) && activeTab.status === "ready" ? activeTab.path : null}
              text={activeTab && pageOf(activeTab.path) ? (activeTab.text ?? null) : null}
              commit={listing.commit}
            />
          </section>
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
            const renamed = new File([files[0]!], target.split("/").pop()!, { type: files[0]!.type });
            void upload(parentOf(target), [renamed]);
          } else {
            void upload(uploadFolder.current, files);
          }
        }}
      />
      <input
        ref={h5pInput}
        type="file"
        accept=".h5p"
        className="sr-only"
        aria-label="Choose H5P content to upload"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const view = h5pView.current;
          if (!file || !view) return;
          // H5P's src is addressed in public/.
          if (await upload("public", [file])) insertAtCursor(view, `::h5p{src="/${file.name}"}`);
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
      <LogDialog buildId={logFor} onClose={() => setLogFor(null)} />
      <BlockDialog
        edit={blockEdit && { ...blockEdit.block, lang: blockEdit.block.lang ?? bookLanguage }}
        onApply={(code) => {
          const { block, view } = blockEdit!;
          // An edit of the page like any other: undoable, saved with the page.
          view.dispatch({ changes: { from: block.from, to: block.to, insert: code } });
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
            await ws.commit([{ op: "write", path: "hyperbook.json", content, baseOid }], "Change the book's settings");
          } catch (error) {
            throw error instanceof ConflictError ? new Error("Someone else changed the settings; open them again.") : error;
          }
          if (ws.tabs.some((t) => t.path === "hyperbook.json")) void ws.reload("hyperbook.json");
          toast.success("Settings saved.");
        }}
      />
    </div>
  );
}

function TabContent({
  tab,
  files,
  onEditBlock,
  onInsertFile,
  onInsertH5P,
  onChange,
  onSave,
  onReplace,
  onDownload,
}: {
  tab: Tab;
  files: string[];
  onEditBlock: (block: Block, view: EditorView) => void;
  onInsertFile: (kind: FileElement, view: EditorView) => void;
  onInsertH5P: (view: EditorView) => void;
  onChange: (text: string) => void;
  onSave: () => void;
  onReplace: () => void;
  onDownload: () => void;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const [pageSettings, setPageSettings] = useState<{ view: EditorView; text: string } | null>(null);
  if (tab.status === "loading") return <p className="p-4 text-muted-foreground">Loading…</p>;
  if (tab.status === "error") return <p className="p-4 text-destructive">{tab.error}</p>;
  const loaded = tab.loaded!;
  if (loaded.kind === "text") {
    const kind = visualKind(tab.path);
    // Both views start from the current text, so switching keeps unsaved changes.
    const source = (
      <CodeEditor
        key={`${tab.path}:${tab.version}`}
        path={tab.path}
        initial={tab.text!}
        onChange={onChange}
        onSave={onSave}
        onEditBlock={onEditBlock}
        onPageSettings={(view) => setPageSettings({ view, text: view.state.doc.toString() })}
        files={files}
        onReady={(view) => (viewRef.current = view)}
      />
    );
    if (pageOf(tab.path)) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center border-b border-border px-2 py-0.5">
            <InsertMenu view={() => viewRef.current} onFileElement={onInsertFile} onH5P={onInsertH5P} />
            {extension(tab.path) === "md" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const view = viewRef.current;
                  if (view) setPageSettings({ view, text: view.state.doc.toString() });
                }}
              >
                <SettingsIcon className="size-4" /> Page settings
              </Button>
            )}
            <span className="flex-1" />
            <span className="hidden text-xs text-muted-foreground md:inline">Type : at the start of a line for elements</span>
          </div>
          <div className="min-h-0 flex-1">{source}</div>
          <PageSettingsDialog
            text={pageSettings?.text ?? null}
            pages={files.flatMap((f) => (f.startsWith("book/") ? (pageOf(f) ?? []) : []))}
            onApply={(form) => {
              const { view } = pageSettings!;
              const text = view.state.doc.toString();
              // An edit of the page like any other: undoable, saved with the page.
              view.dispatch({ changes: { from: 0, to: text.length, insert: withPageForm(text, form) } });
              view.focus();
            }}
            onClose={() => setPageSettings(null)}
          />
        </div>
      );
    }
    if (!kind) return source;
    return <VisualOrSource tab={tab} kind={kind} source={source} onChange={onChange} onSave={onSave} />;
  }
  const size = `${(loaded.size / 1024).toFixed(loaded.size < 10240 ? 1 : 0)} KB`;
  return (
    <div className="grid h-full content-start justify-items-center gap-4 overflow-auto p-6">
      {loaded.kind === "image" ? (
        <img src={loaded.url} alt={tab.path} className="max-h-[60vh] max-w-full rounded-md border border-border object-contain" />
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
  tab,
  kind,
  source,
  onChange,
  onSave,
}: {
  tab: Tab;
  kind: NonNullable<ReturnType<typeof visualKind>>;
  source: React.ReactNode;
  onChange: (text: string) => void;
  onSave: () => void;
}) {
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const problem = visualProblem(kind, tab.text!);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1" role="group" aria-label="View">
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
          <VisualFrame key={`${tab.path}:${tab.version}`} kind={kind} text={tab.text!} onChange={onChange} onSave={onSave} />
        ) : (
          source
        )}
      </div>
    </div>
  );
}
