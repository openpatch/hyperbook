import * as vscode from "vscode";
import * as Constants from "./Constants";
import { hyperbook, hyperproject, VFile, vfile } from "@hyperbook/fs";
import { htmlTemplate } from "./html-template";
import { disposeAll } from "./utils/dispose";
import { ChangeMessage, Message } from "./messages/messageTypes";
import { parseTocFromMarkdown } from "@hyperbook/toc";
import path from "path";
import { HyperbookJson } from "@hyperbook/types";

export default class Preview {
  panel: vscode.WebviewPanel | undefined;
  editor: any;
  context: vscode.ExtensionContext;
  hyperbookViewerConfig: any;

  private _resource: vscode.Uri | undefined;
  private _vfile: VFile | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private _disposed: boolean = false;
  private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
  public readonly onDispose = this._onDisposeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
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
            } as const)
        );
      if (vscode.workspace.rootPath) {
        const projectPath = this.hyperbookViewerConfig.get("root");
        const project = await hyperproject.get(
          path.join(vscode.workspace.rootPath, projectPath)
        );
        const links = [];
        if (config.links) {
          links.push(...config.links);
        }
        if (project.type === "library") {
          const link = await hyperproject.getLink(project, config.language, {
            href: {
              useSrc: true,
              append: ["book/index.md"],
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
      this._resource
    ) {
      if (this._vfile) {
        const { content, data } = await vfile.getMarkdown(this._vfile);
        const navigation = await hyperbook.getNavigation(
          this._vfile.root,
          this._vfile
        );
        const toc = parseTocFromMarkdown(content);

        const state = {
          content,
          data,
          source: this._resource.toString(),
          toc,
          assetsPath: await this.getWorkspacePath(),
          navigation,
        };
        return state;
      }
    }
    return {
      content: "",
      data: {},
      assetsPath: await this.getWorkspacePath(),
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
      const hyperbookRoot = await hyperbook.findRoot(this._resource.fsPath);
      this._vfile = await vfile.getByAbsolutePath(
        hyperbookRoot,
        null,
        this._resource.fsPath
      );

      if (this.checkDocumentIsHyperbookFile(false)) {
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
        hyperbookRoot = await hyperbook.findRoot(this._resource.fsPath);
      } else {
        hyperbookRoot = path.dirname(this._resource.fsPath);
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
      return htmlTemplate(this.context, this.panel);
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
    const supportedLanguages = ["markdown", "yaml", "json"];
    const supportedFiles = ["hyperbook.json", "hyperlibrary.json"];
    const fileName = path.basename(
      vscode.window.activeTextEditor?.document.fileName || ""
    );
    const languageId =
      vscode.window.activeTextEditor?.document.languageId.toLowerCase() || "";
    let isSupported =
      supportedLanguages.includes(languageId) ||
      supportedFiles.includes(fileName);
    if (!isSupported && showWarning) {
      vscode.window.showInformationMessage(
        Constants.ErrorMessages.NO_HYPERBOOK_FILE
      );
    }
    return isSupported;
  }

  async initMarkdownPreview(viewColumn: number) {
    let proceed = this.checkDocumentIsHyperbookFile(false);
    if (proceed) {
      const filePaths = vscode.window.activeTextEditor?.document.fileName || "";
      const fileName = path.basename(filePaths);
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

      this.panel.webview.onDidReceiveMessage(async (m: Message) => {
        if (m.type === "OPEN" && this._vfile) {
          if (m.payload.path.startsWith("file")) {
            const fileUri = vscode.Uri.parse(m.payload.path);
            return vscode.workspace
              .openTextDocument(fileUri)
              .then((doc) =>
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
              );
          }

          const file = await vfile.get(this._vfile.root, null, m.payload.path);

          if (file) {
            const fileUri = vscode.Uri.file(file.path.absolute);
            return vscode.workspace
              .openTextDocument(fileUri)
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
