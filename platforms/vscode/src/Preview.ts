import * as vscode from "vscode";
import * as Constants from "./Constants";
import {
  hyperbook,
  hyperproject,
  vfile,
  VFileBook,
  VFileGlossary,
  getPasswords,
} from "@hyperbook/fs";
// The same single-page builders behind `hyperbook render`, which Hyperbook
// Cloud's editor preview runs — the preview renders through them, too.
import {
  ASSETS_FOLDER,
  buildSingleBookPage,
  buildSingleGlossaryPage,
  makeBaseCtx,
} from "hyperbook/build";
import { disposeAll } from "./utils/dispose";
import fs from "fs/promises";
import { existsSync } from "fs";
import path, { posix } from "path";
import {
  DownloadableElement,
  HyperbookJson,
  HyperbookPage,
  Hyperproject,
  elementCdn,
  isExternalUrl,
} from "@hyperbook/types";
import RuntimeAssets, { runtimeElements, runtimeLabels } from "./RuntimeAssets";

// Helper function to resolve relative paths
const resolveRelativePath = (path: string, page: HyperbookPage): string => {
  // If path is absolute, return as-is
  if (path.startsWith("/")) {
    return path;
  }

  // Get the directory of the current page
  // Use page.path.directory if available, otherwise derive from href
  let currentPageDir: string;
  if (page.path?.directory) {
    currentPageDir = posix.join("/", page.path.directory);
  } else {
    currentPageDir = posix.dirname(page.href || "/");
  }

  // Resolve the relative path and normalize
  return posix.normalize(posix.resolve(currentPageDir, path));
};

export default class Preview {
  panel: vscode.WebviewPanel | undefined;
  editor: any;
  context: vscode.ExtensionContext;
  hyperbookViewerConfig: any;

  private _resource: vscode.Uri | undefined;
  private _vfile: VFileBook | VFileGlossary | undefined;

  runtimes: RuntimeAssets;
  /** Elements that load from their CDN only because their runtime is missing. */
  private cdnFallbacks = new Set<DownloadableElement>();
  /** Elements the user was already offered a download for. */
  private readonly offeredDownloads = new Set<DownloadableElement>();


  private readonly disposables: vscode.Disposable[] = [];
  private _disposed: boolean = false;
  private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
  public readonly onDispose = this._onDisposeEmitter.event;

  /**
   * Squiggles for the diagnostics the markdown plugins already produce — most
   * usefully the wrong-number-of-colons messages from remarkHelper, which were
   * previously computed on every render and discarded.
   */
  private static readonly diagnostics =
    vscode.languages.createDiagnosticCollection("hyperbook");

  constructor(context: vscode.ExtensionContext, runtimes: RuntimeAssets) {
    this.context = context;
    this.runtimes = runtimes;
    runtimes.onDidChange(() => this.handleTextDocumentChange());


    vscode.workspace.onDidChangeTextDocument(async (e) => {
      // Only refresh when hyperbook config files change
      if (
        e.document.fileName.endsWith("hyperbook.json") ||
        e.document.fileName.endsWith("hyperlibrary.json")
      ) {
        await this.handleTextDocumentChange();
      }
    });
  }

  async getConfig() {
    if (this._resource) {
      const hyperbookRoot = await hyperbook
        .findRoot(this._resource.fsPath)
        .catch(() => "");
      const config: HyperbookJson = await hyperbook
        .find(this._resource.fsPath)
        .catch(
          () =>
            ({
              name: "@Hyperbook@",
            }) as const,
        );
      const rootPath = vscode.workspace.getWorkspaceFolder(this._resource);
      if (rootPath) {
        const project = await this.getRootProject();
        const links = [];
        if (config.links) {
          links.push(...config.links);
        }
        if (project && project.type === "library") {
          const link = await hyperproject.getLink(project, config.language, {
            href: {
              useSrc: true,
              append: ["book/index.md"],
              protocol: "file:///",
            },
          });
          links.push(link);
        }
        const basePath = path.relative(rootPath.uri.fsPath, hyperbookRoot);

        return {
          ...config,
          basePath,
          links,
        } as HyperbookJson;
      }
      return config;
    } else {
      return {
        name: "Hyperbook",
      };
    }
  }

  /** The workspace's hyperproject (book or library), if there is one. */
  private async getRootProject(): Promise<Hyperproject | undefined> {
    if (!this._resource) {
      return undefined;
    }
    const rootPath = vscode.workspace.getWorkspaceFolder(this._resource);
    if (!rootPath) {
      return undefined;
    }
    const projectPath = this.hyperbookViewerConfig.get("root");
    return hyperproject.get(path.join(rootPath.uri.fsPath, projectPath));
  }

  /**
   * Resolves element runtimes like a Hyperbook build. An element with a CDN in
   * the book's config loads from it. Every other element uses its local
   * runtime: shipped with a development build of the extension, or downloaded
   * into the Hyperbook CLI's asset cache. A runtime that is not downloaded yet
   * loads from the element's default CDN, so the preview still works.
   */
  async withRuntimes(config: HyperbookJson): Promise<HyperbookJson> {
    const elements: Record<string, any> = { ...config.elements };
    const fallbacks = new Set<DownloadableElement>();
    for (const element of runtimeElements) {
      if (elementCdn(config, element)) {
        continue;
      }
      const location = await this.runtimes.locate(element);
      if (location.kind === "bundled") {
        continue;
      }
      let cdn: string | true = true;
      if (location.kind === "cached" && this.panel) {
        // A custom CDN URL points at the contents of directive-<element>/.
        // Pyodide's URL points at its distribution folder instead.
        cdn =
          this.panel.webview
            .asWebviewUri(vscode.Uri.file(location.directory))
            .toString()
            .replace(/\/?$/, "/") + (element === "pyide" ? "pyodide/" : "");
      } else {
        fallbacks.add(element);
      }
      elements[element] = { ...elements[element], cdn };
    }
    this.cdnFallbacks = fallbacks;
    return { ...config, elements };
  }

  /** Offers to download the missing runtimes a page uses, once per element. */
  private offerDownloads(used: DownloadableElement[]) {
    const missing = used.filter(
      (element) =>
        this.cdnFallbacks.has(element) && !this.offeredDownloads.has(element),
    );
    if (missing.length === 0) {
      return;
    }
    missing.forEach((element) => this.offeredDownloads.add(element));
    const names = missing.map((element) => runtimeLabels[element]).join(", ");
    vscode.window
      .showInformationMessage(
        `Hyperbook: The preview loads ${names} from the internet. Download the runtime to preview it offline, like a Hyperbook build.`,
        "Download",
      )
      .then((choice) => {
        if (choice === "Download") {
          vscode.commands.executeCommand("hyperbook.downloadRuntimes", missing);
        }
      });
  }

  /** Elements used by the current page, for preselecting downloads. */
  usedElements: DownloadableElement[] = [];

  async handleTextDocumentChange() {
    this.hyperbookViewerConfig = vscode.workspace.getConfiguration("hyperbook");
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(true) &&
      this.panel &&
      this.panel !== undefined
    ) {
      this._resource = vscode.window.activeTextEditor.document.uri;
      const filePaths =
        vscode.window.activeTextEditor.document.fileName.split("/");
      const fileName = filePaths[filePaths.length - 1];

      const hyperbookRoot = await hyperbook.findRoot(this._resource.fsPath);
      const resourcePath = this._resource.fsPath;
      this._vfile = await vfile
        .get(hyperbookRoot, "book", resourcePath, "absolute")
        .catch(async () => {
          return vfile.get(hyperbookRoot, "glossary", resourcePath, "absolute");
        });

      this.panel.title = `[Preview] ${fileName}`;

      const pagesAndSections = await hyperbook.getPagesAndSections(
        this._vfile.root,
      );
      const pageList = hyperbook.getPageList(
        pagesAndSections.sections,
        pagesAndSections.pages,
      );
      const files = await vfile.list(this._vfile.root);
      const publicFiles = await vfile.listForFolder(this._vfile.root, "public");
      const publicBookFiles = await vfile.listForFolder(
        this._vfile.root,
        "book-public",
      );
      const publicGlossaryFiles = await vfile.listForFolder(
        this._vfile.root,
        "glossary-public",
      );
      const otherFiles = [
        ...publicFiles,
        ...publicBookFiles,
        ...publicGlossaryFiles,
      ];
      const config = await this.withRuntimes(await this.getConfig());

      // Without this a `:::protect{use="..."}` block fails to render in the
      // preview, even though it builds fine.
      const { passwords } = await getPasswords(this._vfile.root, config, {
        reload: true,
      });

      // Where the shared page builders write the rendered page, like
      // `hyperbook render` does.
      const rootOut = path.join(this._vfile.root, ".hyperbook", "out");
      const assetsOut = path.join(rootOut, ASSETS_FOLDER);

      // The preview's makeUrl: like a build's, but URLs work inside a
      // webview — assets and public files become webview URIs, page links
      // open the file in the editor.
      const makeUrl = (
        path: string | string[],
        base: "public" | "book" | "archive" | "glossary" | "assets",
        page?: HyperbookPage,
      ) => {
          if (typeof path === "string") {
            // Handle absolute URLs
            if (isExternalUrl(path)) {
              return path;
            }

            // Strip markdown file extensions
            if (path.endsWith(".md.hbs")) {
              path = path.slice(0, -7);
            } else if (path.endsWith(".md.json")) {
              path = path.slice(0, -8);
            } else if (path.endsWith(".md.yml")) {
              path = path.slice(0, -7);
            } else if (path.endsWith(".md")) {
              path = path.slice(0, -3);
            }

            // Handle relative paths when we have a current page context
            if (page && !path.startsWith("/")) {
              path = resolveRelativePath(path, page);
            }

            path = [path];
          }

          // Handle array paths - strip extensions and resolve relative segments
          if (Array.isArray(path) && page) {
            path = path.map((segment) => {
              if (typeof segment === "string") {
                // Strip markdown file extensions from array segments
                if (segment.endsWith(".md.hbs")) {
                  segment = segment.slice(0, -7);
                } else if (segment.endsWith(".md.json")) {
                  segment = segment.slice(0, -8);
                } else if (segment.endsWith(".md.yml")) {
                  segment = segment.slice(0, -7);
                } else if (segment.endsWith(".md")) {
                  segment = segment.slice(0, -3);
                }
                
                if (!segment.startsWith("/")) {
                  return resolveRelativePath(segment, page);
                }
              }
              return segment;
            });
          }

          switch (base) {
            case "assets": {
              // Files a directive generates while rendering (directive src=
              // payloads) live in the render output; everything else comes
              // from the extension's bundled assets.
              const generated = vscode.Uri.joinPath(
                vscode.Uri.file(assetsOut),
                ...path,
              );
              const bundled = vscode.Uri.joinPath(
                this.context.extensionUri,
                "assets",
                "hyperbook",
                ...path,
              );
              const target = existsSync(generated.fsPath) ? generated : bundled;
              return (
                this.panel?.webview.asWebviewUri(target).toString() || ""
              );
            }

            case "public":
              const otherFile = otherFiles.find(
                (f) => f.path.href === path.join("/"),
              );
              let directory = otherFile?.path.directory || "";
              if (otherFile?.folder === "public") {
                directory = "public";
              } else if (otherFile?.folder === "book-public") {
                directory = "book";
              } else if (otherFile?.folder === "glossary-public") {
                directory = "glossary";
              }
              return (
                this.panel?.webview
                  .asWebviewUri(
                    vscode.Uri.joinPath(
                      vscode.Uri.file(this._vfile?.root || ""),
                      directory,
                      otherFile?.path.relative || "",
                    ),
                  )
                  .toString() || ""
              );

            case "glossary":
              // For glossary links in VSCode, try to find the file and open it
              const glossaryPath = posix.join("glossary", ...path);
              const glossaryFile = files.find(
                (f) => f.path.href === glossaryPath,
              );
              if (glossaryFile) {
                const fileUri = {
                  scheme: "file",
                  path: glossaryFile?.path.absolute || "",
                  authority: "",
                };
                return `command:vscode.open?${encodeURIComponent(JSON.stringify(fileUri))}`;
              }
              return "#";

            case "book":
            case "archive":
              // For book and archive links, try to find the file and open it
              const targetPath =
                base === "archive"
                  ? posix.join("archives", ...path)
                  : path.join("/");
              const file = files.find((f) => f.path.href === targetPath);
              if (file) {
                const fileUri = {
                  scheme: "file",
                  path: file?.path.absolute || "",
                  authority: "",
                };
                return `command:vscode.open?${encodeURIComponent(JSON.stringify(fileUri))}`;
              }
              return "#";

            default:
              // Fallback for any other base types
              const defaultFile = files.find(
                (f) => f.path.href === path.join("/"),
              );
              if (defaultFile) {
                const fileUri = {
                  scheme: "file",
                  path: defaultFile?.path.absolute || "",
                  authority: "",
                };
                return `command:vscode.open?${encodeURIComponent(JSON.stringify(fileUri))}`;
              }
              return "#";
          }
      };

      // Render through the same single-page builders as `hyperbook render`
      // (Hyperbook Cloud's editor preview), so the preview shows exactly what
      // a build produces. Only makeUrl differs, mapping URLs into the webview.
      const project =
        (await this.getRootProject()) ??
        ({
          name: config.name,
          src: this._vfile.root,
          type: "book",
        } as Hyperproject);
      const baseCtx = {
        ...makeBaseCtx(this._vfile.root, config, config.basePath, project),
        passwords,
        makeUrl,
      };
      const result =
        this._vfile.folder === "glossary"
          ? await buildSingleGlossaryPage(
              this._vfile as VFileGlossary,
              baseCtx,
              pageList,
              pagesAndSections,
              rootOut,
              assetsOut,
              config,
            )
          : await buildSingleBookPage(
              this._vfile as VFileBook,
              baseCtx,
              pageList,
              pagesAndSections,
              rootOut,
              assetsOut,
              config,
            );

      this.publishDiagnostics(result.rawMessages);
      // Blockflow registers as blockflow-player and blockflow-editor.
      this.usedElements = runtimeElements.filter((element) =>
        result.directives.some(
          (name) => name === element || name.startsWith(`${element}-`),
        ),
      );
      this.offerDownloads(this.usedElements);

      const href =
        this._vfile.path.href ||
        (this._vfile.folder === "glossary" ? "/glossary" : "/");
      const outFile =
        this._vfile.name === "index" || config.trailingSlash
          ? posix.join(href, "index.html")
          : `${href}.html`;
      this.panel.webview.html = await fs.readFile(
        path.join(rootOut, outFile),
        "utf8",
      );
    }
  }

  /**
   * Maps the processed file's messages back onto the open document.
   *
   * Positions are relative to the markdown that was handed to the pipeline,
   * which has had its frontmatter stripped and its snippets inlined. The line
   * offset from frontmatter is recoverable; snippet expansion is not, so when
   * the content no longer matches the source the diagnostics are dropped rather
   * than pointed at the wrong lines.
   */
  private publishDiagnostics(messages: unknown[]): void {
    if (!this._resource || !this._vfile) return;

    const uri = this._resource;
    if (messages.length === 0) {
      Preview.diagnostics.delete(uri);
      return;
    }

    const document = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString(),
    );
    if (!document) return;

    const source = document.getText();
    const processed = this._vfile.markdown.content;

    // The processed content must appear verbatim at the end of the source for
    // the offset to be a simple line shift.
    if (!source.endsWith(processed)) {
      Preview.diagnostics.delete(uri);
      return;
    }
    const lineOffset = source.slice(0, source.length - processed.length).split("\n")
      .length - 1;

    const diagnostics: vscode.Diagnostic[] = [];
    for (const raw of messages) {
      const message = raw as {
        reason?: string;
        fatal?: boolean | null;
        line?: number | null;
        column?: number | null;
      };
      if (!message.reason || !message.line) continue;

      const line = message.line - 1 + lineOffset;
      const column = Math.max((message.column || 1) - 1, 0);
      const range = document.lineAt(
        Math.min(line, document.lineCount - 1),
      ).range;

      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(range.start.translate(0, column), range.end),
          message.reason,
          message.fatal
            ? vscode.DiagnosticSeverity.Error
            : message.fatal === false
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information,
        ),
      );
    }

    Preview.diagnostics.set(uri, diagnostics);
  }

  checkDocumentIsHyperbookFile(showWarning: boolean): boolean {
    const supportedLanguages = ["markdown", "yaml", "json", "handlebars"];
    const supportedFiles = ["hyperbook.json", "hyperlibrary.json"];
    const fileName = path.basename(
      vscode.window.activeTextEditor?.document.fileName || "",
    );
    const languageId =
      vscode.window.activeTextEditor?.document.languageId.toLowerCase() || "";
    let isSupported =
      supportedLanguages.includes(languageId) ||
      supportedFiles.includes(fileName);
    if (!isSupported && showWarning) {
      vscode.window.showInformationMessage(
        Constants.ErrorMessages.NO_HYPERBOOK_FILE,
      );
    }
    return isSupported;
  }

  async initMarkdownPreview(viewColumn: number) {
    if (this.checkDocumentIsHyperbookFile(true)) {
      const filePaths = vscode.window.activeTextEditor?.document.fileName || "";
      const fileName = path.basename(filePaths);
      this.panel = vscode.window.createWebviewPanel(
        "liveHTMLPreview",
        "[Preview]" + fileName,
        { viewColumn, preserveFocus: false },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          enableCommandUris: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, "assets"),
            vscode.Uri.file(this.runtimes.cacheDir),
            vscode.Uri.file(vscode.workspace?.rootPath || ""),
          ],
        },
      );

      this.panel.iconPath = this.iconPath;
      this._disposed = false;

      this.editor = vscode.window.activeTextEditor;
      await this.handleTextDocumentChange.call(this);

      vscode.workspace.onDidChangeConfiguration(
        this.handleTextDocumentChange.bind(this),
        null,
        this.disposables,
      );
      
      const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");
      fileWatcher.onDidChange(
        async (uri) => {
          if (this.panel) {
            // If the changed file is within the current hyperbook root, refresh preview
            const hyperbookRoot = this._resource
              ? await hyperbook.findRoot(this._resource.fsPath).catch(() => "")
              : "";
            if (hyperbookRoot && uri.fsPath.startsWith(hyperbookRoot)) {
              await this.handleTextDocumentChange();
            }
          }
        },
        null,
        this.disposables,
      );
      
      vscode.workspace.onDidSaveTextDocument(
        this.handleTextDocumentChange.bind(this),
        null,
        this.disposables,
      );
      vscode.window.onDidChangeActiveTextEditor(
        this.handleTextDocumentChange.bind(this),
        null,
        this.disposables,
      );

      this.panel.onDidDispose(
        () => {
          this.dispose();
        },
        null,
        this.disposables,
      );
    }
  }

  private get iconPath() {
    const root = vscode.Uri.joinPath(this.context.extensionUri, "assets/icons");
    return {
      light: vscode.Uri.joinPath(root, "Preview.svg"),
      dark: vscode.Uri.joinPath(root, "Preview_inverse.svg"),
    };
  }

  public dispose() {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._onDisposeEmitter.fire();

    this._onDisposeEmitter.dispose();
    this.panel?.dispose();

    disposeAll(this.disposables);
  }
}
