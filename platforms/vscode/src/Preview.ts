import * as vscode from "vscode";
import * as Constants from "./Constants";
import {
  hyperbook,
  hyperproject,
  VFileBook,
  VFileGlossary,
  vfile,
  VFile,
  getMarkdown,
} from "@hyperbook/fs";
import { htmlTemplate } from "./html-template";
import { disposeAll } from "./utils/dispose";
import {
  ChangeBookFileMessage,
  ChangeGlossaryFileMessage,
  Message,
} from "./messages/messageTypes";
import path from "path";
import { HyperbookJson, Navigation } from "@hyperbook/types";

export default class Preview {
  panel: vscode.WebviewPanel | undefined;
  editor: any;
  context: vscode.ExtensionContext;
  hyperbookViewerConfig: any;

  private _resource: vscode.Uri | undefined;
  private _vfile: VFileBook | VFileGlossary | undefined;
  private _navigation: Navigation | undefined;

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
      const rootPath = vscode.workspace.getWorkspaceFolder(this._resource);
      if (rootPath) {
        const projectPath = this.hyperbookViewerConfig.get("root");
        const project = await hyperproject.get(
          path.join(rootPath.uri.fsPath, projectPath)
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

  async getPageProps(
    refreshNavigation = false
  ): Promise<ChangeBookFileMessage["payload"]> {
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(false) &&
      this._vfile &&
      this.panel
    ) {
      if (!this._navigation || refreshNavigation) {
        await vfile.clean(this._vfile.root);
        this._navigation = await hyperbook.getNavigation(
          this._vfile.root,
          this._vfile
        );
      }
      const assetsPath = this.panel.webview
        .asWebviewUri(vscode.Uri.file(this._vfile.root))
        .toString();

      return {
        navigation: this._navigation,
        data: this._vfile.markdown.data,
        markdown: this._vfile.markdown.content,
        locale: this._vfile.markdown.data.lang || "en",
        assetsPath,
      };
    }
    return {
      navigation: {
        current: null,
        next: null,
        pages: [],
        previous: null,
        sections: [],
      },
      assetsPath: "",
      data: { name: "Not Found" },
      locale: "en",
      markdown: "",
    };
  }

  async getTermProps(
    refreshNavigation = false
  ): Promise<ChangeGlossaryFileMessage["payload"]> {
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(false) &&
      this._vfile &&
      this._vfile.folder === "glossary" &&
      this.panel
    ) {
      if (!this._navigation || refreshNavigation) {
        await vfile.clean(this._vfile.root);
        this._navigation = await hyperbook.getNavigation(
          this._vfile.root,
          this._vfile
        );
      }
      const assetsPath = this.panel.webview
        .asWebviewUri(vscode.Uri.file(this._vfile.root))
        .toString();

      return {
        references: this._vfile.references,
        navigation: this._navigation,
        data: this._vfile.markdown.data,
        markdown: this._vfile.markdown.content,
        locale: this._vfile.markdown.data.lang || "en",
        assetsPath,
      };
    }
    return {
      references: [],
      navigation: {
        current: null,
        next: null,
        pages: [],
        previous: null,
        sections: [],
      },
      assetsPath: "",
      data: { name: "Not Found" },
      locale: "en",
      markdown: "",
    };
  }

  /*
   * Update everything including the navigation
   */
  async fullUpdate() {
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
      const resourcePath = this._resource.fsPath;
      this._vfile = await vfile
        .get(hyperbookRoot, "book", resourcePath, "absolute")
        .catch(async () => {
          return vfile.get(hyperbookRoot, "glossary", resourcePath, "absolute");
        });

      if (this._vfile.folder === "glossary") {
        console.log("Full glossary update");
        this.postMessage({
          type: "CHANGE_GLOSSARY_FILE",
          payload: await this.getTermProps(true),
        });
      } else {
        console.log("Full book update");
        this.postMessage({
          type: "CHANGE_BOOK_FILE",
          payload: await this.getPageProps(true),
        });
      }
      this.postMessage({
        type: "CONFIG_CHANGE",
        payload: await this.getConfig(),
      });
    }
  }

  /*
   * Only update the content and data
   */
  async partialUpdate() {
    this.hyperbookViewerConfig = vscode.workspace.getConfiguration("hyperbook");
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsHyperbookFile(false) &&
      this.panel &&
      this._vfile
    ) {
      console.log("Partial update");

      this._vfile = {
        ...this._vfile,
        markdown: await getMarkdown(this._vfile),
      };

      if (this._vfile.folder === "glossary") {
        this.postMessage({
          type: "CHANGE_GLOSSARY_FILE",
          payload: await this.getTermProps(true),
        });
      } else {
        this.postMessage({
          type: "CHANGE_BOOK_FILE",
          payload: await this.getPageProps(true),
        });
      }
    }
  }

  async getWebviewContent() {
    if (this.panel) {
      return htmlTemplate(this.context, this.panel);
    } else {
      return "";
    }
  }

  checkDocumentIsHyperbookFile(showWarning: boolean): boolean {
    const supportedLanguages = ["markdown", "yaml", "json", "handlebars"];
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
      await this.fullUpdate.call(this);

      vscode.workspace.onDidChangeTextDocument(this.partialUpdate.bind(this));
      vscode.workspace.onDidChangeConfiguration(this.partialUpdate.bind(this));
      vscode.workspace.onDidSaveTextDocument(this.partialUpdate.bind(this));
      vscode.window.onDidChangeActiveTextEditor(this.fullUpdate.bind(this));

      this.panel.webview.onDidReceiveMessage(async (m: Message) => {
        if (m.type === "OPEN" && this._vfile) {
          console.log(m);
          if (m.payload.path.startsWith("file")) {
            const fileUri = vscode.Uri.parse(m.payload.path);
            return vscode.workspace
              .openTextDocument(fileUri)
              .then((doc) =>
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
              );
          }

          let file: VFile = await vfile.get(
            this._vfile.root,
            (m.payload.rootFolder as any) || "book",
            m.payload.path
          );

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
          this.fullUpdate();
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
