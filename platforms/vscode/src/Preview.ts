import * as vscode from "vscode";
import * as Constants from "./Constants";
import matter from "gray-matter";
import {
  findHyperbook,
  findHyperbookRoot,
  makeLinkForHyperproject,
  makeNavigationForHyperbook,
  readProject,
  resolveSnippets,
} from "@hyperbook/fs";
import { htmlTemplate } from "./html-template";
import { disposeAll } from "./utils/dispose";
import { ChangeMessage, Message } from "./messages/messageTypes";
import { parseTocFromMarkdown } from "@hyperbook/toc";
import path from "path";
import { HyperbookJson } from "@hyperbook/types";

export default class Preview {
  panel: vscode.WebviewPanel | undefined;
  editor: any;
  line: number | undefined;
  disableWebViewStyling: boolean;
  context: vscode.ExtensionContext;
  hyperbookViewerConfig: any;
  private _resource: vscode.Uri | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private _disposed: boolean = false;
  private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
  public readonly onDispose = this._onDisposeEmitter.event;

  //returns true if an html document is open
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.disableWebViewStyling = false;
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (
        e.document.fileName.endsWith("hyperbook.json") ||
        e.document.fileName.endsWith("hyperlibrary.json")
      ) {
        this.postMessage({
          type: "CONFIG_CHANGE",
          payload: await this.getConfig(),
        });
      }
    });
  }

  async handleTextDocumentChange() {
    return this.postUpdate();
  }

  parseConfig(config: string) {
    try {
      return JSON.parse(config);
    } catch (e) {
      return {};
    }
  }

  async getConfig() {
    if (vscode.window.activeTextEditor && this._resource) {
      const startUri = this._resource;
      const hyperbookRoot = await findHyperbookRoot(startUri?.fsPath).catch(
        () => ""
      );
      const config: HyperbookJson = await findHyperbook(startUri?.fsPath).catch(
        () =>
          ({
            name: "@Hyperbook@",
          } as const)
      );
      if (vscode.workspace.rootPath && config.name !== "@Hyperbook@") {
        const projectPath = this.hyperbookViewerConfig.get("root");
        const project = await readProject(
          path.join(vscode.workspace.rootPath, projectPath)
        );
        const links = [];
        if (config.links) {
          links.push(...config.links);
        }
        if (project.type === "library") {
          const link = await makeLinkForHyperproject(project, config.language, {
            href: {
              useSrc: true,
              append: ["index.md"],
              protocol: "file:///",
            },
          });
          links.push(link);
        }
        const basePath = path.relative(
          vscode.workspace.rootPath,
          hyperbookRoot
        );

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

  async getState(): Promise<ChangeMessage["payload"]> {
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(false) &&
      vscode.window.activeTextEditor.document.languageId === "markdown" &&
      this._resource
    ) {
      const { content, data } = matter(
        vscode.window.activeTextEditor?.document.getText()
      );
      const toc = parseTocFromMarkdown(content);
      const root = await findHyperbookRoot(this._resource.fsPath);
      const contentWithSnippets = await resolveSnippets(root, content);
      let currPath = path.relative(
        path.join(root, "book"),
        this._resource.fsPath
      );
      if (!currPath.startsWith("/")) {
        currPath = "/" + currPath;
      }
      if (currPath.endsWith("index.md")) {
        currPath = currPath.slice(0, -8);
      }
      if (currPath.endsWith(".md")) {
        currPath = currPath.slice(0, -3);
      }

      const navigation = await makeNavigationForHyperbook(root, currPath);
      const state = {
        content: contentWithSnippets,
        data,
        source: this._resource.toString(),
        toc,
        assetsPath: await this.getWorkspacePath(),
        navigation,
      };
      return state;
    }
    return {
      content: "",
      data: {},
      assetsPath: "",
      source: "",
    };
  }

  async postUpdate() {
    this.hyperbookViewerConfig = vscode.workspace.getConfiguration("hyperbook");
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(false) &&
      this.panel &&
      this.panel !== undefined
    ) {
      const filePaths =
        vscode.window.activeTextEditor.document.fileName.split("/");
      const fileName = filePaths[filePaths.length - 1];
      this.panel.title = `[Preview] ${fileName}`;
      this._resource = vscode.window.activeTextEditor.document.uri;
      if (
        vscode.window.activeTextEditor.document.languageId === "markdown" &&
        this.hyperbookViewerConfig.get("preview.scrollPreviewWithEditor")
      ) {
        this.postMessage({
          type: "SCROLL_FROM_EXTENSION",
          payload: {
            line: vscode.window.activeTextEditor.visibleRanges,
            source: vscode.window.activeTextEditor.document,
          },
        });
      }
      if (vscode.window.activeTextEditor.document.languageId === "markdown") {
        this.postMessage({
          type: "CHANGE",
          payload: await this.getState(),
        });
        this.postMessage({
          type: "CONFIG_CHANGE",
          payload: await this.getConfig(),
        });
      }
    }
  }

  async getWorkspacePath(): Promise<string> {
    if (this.panel && this._resource?.fsPath) {
      let hyperbookRoot = this._resource.fsPath;
      if (!this._resource.fsPath.endsWith("hyperbook.json")) {
        hyperbookRoot = await findHyperbookRoot(this._resource.fsPath);
      }

      const basePath = this.panel.webview
        .asWebviewUri(vscode.Uri.file(hyperbookRoot))
        .toString();

      return basePath;
    }

    return "";
  }

  async getWebviewContent() {
    if (this.panel) {
      return htmlTemplate(
        this.context,
        this.panel,
        await this.getState(),
        await this.getConfig()
      );
    } else {
      return "";
    }
  }

  getDynamicContentPath(filepath: string) {
    const onDiskPath = vscode.Uri.joinPath(
      vscode.Uri.parse(vscode.workspace.rootPath || ""),
      "content/media",
      filepath
    );
    const styleSrc = this.panel?.webview.asWebviewUri(onDiskPath);
    return styleSrc;
  }

  checkDocumentIsHyperbookFile(showWarning: boolean): boolean {
    let isMarkdown =
      vscode.window.activeTextEditor?.document.languageId.toLowerCase() ===
      "markdown";
    let isHyperbookJson =
      vscode.window.activeTextEditor?.document.fileName.endsWith(
        "hyperbook.json"
      ) || false;
    let isHyperlibraryJson =
      vscode.window.activeTextEditor?.document.fileName.endsWith(
        "hyperlibrary.json"
      ) || false;
    if (!isMarkdown && !isHyperbookJson && showWarning && !isHyperlibraryJson) {
      vscode.window.showInformationMessage(
        Constants.ErrorMessages.NO_HYPERBOOK_FILE
      );
    }
    return isMarkdown || isHyperbookJson || isHyperbookJson;
  }

  async initMarkdownPreview(viewColumn: number) {
    let proceed = this.checkDocumentIsHyperbookFile(false);
    if (proceed) {
      const filePaths =
        vscode.window.activeTextEditor?.document.fileName.split("/") || [];
      const fileName = filePaths[filePaths.length - 1];
      // Create and show a new webview
      this.panel = vscode.window.createWebviewPanel(
        "liveHTMLPreviewer",
        "[Preview] " + fileName,
        viewColumn,
        {
          // Enable scripts in the webview
          enableScripts: true,
          retainContextWhenHidden: true,
          // And restrict the webview to only loading content from our extension's `assets` directory.
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, "out", "app"),
            vscode.Uri.joinPath(this.context.extensionUri, "assets"),
            vscode.Uri.file(vscode.workspace?.rootPath || ""),
          ],
        }
      );

      this.panel.iconPath = this.iconPath;
      this._disposed = false;

      this.panel.webview.html = await this.getWebviewContent();

      // And set its HTML content
      this.editor = vscode.window.activeTextEditor;
      await this.handleTextDocumentChange.call(this);

      vscode.workspace.onDidChangeTextDocument(
        this.handleTextDocumentChange.bind(this)
      );
      vscode.workspace.onDidChangeConfiguration(
        this.handleTextDocumentChange.bind(this)
      );
      vscode.workspace.onDidSaveTextDocument(
        this.handleTextDocumentChange.bind(this)
      );
      vscode.window.onDidChangeActiveTextEditor(
        this.handleTextDocumentChange.bind(this)
      );

      vscode.window.onDidChangeTextEditorVisibleRanges(
        ({ textEditor, visibleRanges }) => {
          this.hyperbookViewerConfig =
            vscode.workspace.getConfiguration("hyperbook");
          if (
            textEditor.document.languageId === "markdown" &&
            this.hyperbookViewerConfig.get("preview.scrollPreviewWithEditor")
          ) {
            this.postMessage({
              type: "SCROLL_FROM_EXTENSION",
              payload: {
                line: visibleRanges,
                source: textEditor.document,
              },
            });
          }
        }
      );

      this.panel.webview.onDidReceiveMessage(async (m: Message) => {
        if (m.type === "SCROLL_FROM_WEBVIEW") {
          this.onDidScrollPreview(m.payload.line);
        } else if (m.type === "OPEN") {
          const indexPath = path.join(
            vscode.workspace.rootPath || "",
            m.payload.basePath || "",
            m.payload.rootFolder || "",
            m.payload.path,
            "index.md"
          );
          const indexFileUri = vscode.Uri.file(indexPath);
          const hasExtension = m.payload.path.split(".").length > 1;
          if (!hasExtension) {
            m.payload.path += ".md";
          }

          const fileUri = vscode.Uri.file(
            path.join(
              vscode.workspace.rootPath || "",
              m.payload.basePath || "",
              m.payload.rootFolder || "",
              m.payload.path
            )
          );
          try {
            await vscode.workspace.fs.stat(fileUri);
            return vscode.workspace
              .openTextDocument(fileUri)
              .then((doc) =>
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
              );
          } catch (e) {
            return vscode.workspace
              .openTextDocument(indexFileUri)
              .then((doc) =>
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
              );
          }
        } else if (m.type === "WRITE") {
          const hasExtension = m.payload.path.split(".").length > 1;
          if (!hasExtension) {
            m.payload.path += ".md";
          }

          return vscode.workspace.fs.writeFile(
            vscode.Uri.file(
              path.join(
                vscode.workspace.rootPath || "",
                m.payload.basePath || "",
                m.payload.rootFolder || "",
                m.payload.path
              )
            ),
            Buffer.from(m.payload.content, "utf8")
          );
        } else if (m.type === "READY") {
          this.handleTextDocumentChange();
        }
      });

      this.panel.onDidDispose(
        () => {
          this.dispose();
        },
        null,
        this.disposables
      );
    }
  }

  private onDidScrollPreview(line: number) {
    this.line = line;
    for (const editor of vscode.window.visibleTextEditors) {
      if (!this.isPreviewOf(editor.document.uri)) {
        continue;
      }
      const sourceLine = Math.floor(line);
      const fraction = line - sourceLine;
      const text = editor.document.lineAt(sourceLine).text;
      const start = Math.floor(fraction * text.length);
      editor.revealRange(
        new vscode.Range(sourceLine, start, sourceLine + 1, 0),
        vscode.TextEditorRevealType.AtTop
      );
    }
  }

  private isPreviewOf(resource: vscode.Uri): boolean {
    return this._resource?.fsPath === resource.fsPath;
  }

  private get iconPath() {
    const root = vscode.Uri.joinPath(this.context.extensionUri, "assets/icons");
    return {
      light: vscode.Uri.joinPath(root, "Preview.svg"),
      dark: vscode.Uri.joinPath(root, "Preview_inverse.svg"),
    };
  }

  private postMessage(msg: Message) {
    if (!this._disposed) {
      this.panel?.webview.postMessage(msg);
    }
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
