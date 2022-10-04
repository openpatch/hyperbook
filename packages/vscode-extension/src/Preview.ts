"use strict";
import * as vscode from "vscode";
import * as Constants from "./Constants";
import * as path from "path";
import * as fs from "fs";
import matter from "gray-matter";
import { htmlTemplate } from "./html-template";
import { disposeAll } from "./utils/dispose";
import { Message } from "./messages/messageTypes";

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
    vscode.workspace.onDidSaveTextDocument((e) => {
      const { name, ext } = path.parse(e.fileName);
      if (name === "hyperbook" && ext === ".json") {
        this.postMessage({
          type: "CONFIG_CHANGE",
          payload: this.parseConfig(e.getText()),
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

  getConfig() {
    return this.parseConfig(
      Buffer.from(
        fs.readFileSync(
          path.join(vscode.workspace.rootPath || "", "hyperbook.json")
        )
      ).toString("utf8")
    );
  }

  getState() {
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsMarkdown(true) &&
      vscode.window.activeTextEditor.document.languageId === "markdown"
    ) {
      const { content, data } = matter(
        vscode.window.activeTextEditor?.document.getText()
      );
      const state = {
        content,
        data,
        source: vscode.window.activeTextEditor?.document.uri.toString(),
        config: this.getConfig(),
      };
      return state;
    }
    return {
      content: "",
      data: {},
      source: "",
    };
  }

  async postUpdate() {
    this.hyperbookViewerConfig = vscode.workspace.getConfiguration("hyperbook");
    if (
      vscode.window.activeTextEditor &&
      this.checkDocumentIsMarkdown(true) &&
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
          type: "CHANGE",
          payload: this.getState(),
        });
        this.postMessage({
          type: "SCROLL_FROM_EXTENSION",
          payload: {
            line: vscode.window.activeTextEditor.visibleRanges,
            source: vscode.window.activeTextEditor.document,
          },
        });
      }
    }
  }

  getWebviewContent() {
    if (this.panel) {
      return htmlTemplate(
        this.context,
        this.panel,
        this.getState(),
        this.getConfig()
      );
    } else {
      return "";
    }
  }

  getDynamicContentPath(filepath: string) {
    const onDiskPath = vscode.Uri.file(
      path.join(vscode.workspace.rootPath || "", "content/media", filepath)
    );
    const styleSrc = this.panel?.webview.asWebviewUri(onDiskPath);
    return styleSrc;
  }

  getDocumentType(): string {
    let languageId =
      vscode.window.activeTextEditor?.document.languageId.toLowerCase();
    return languageId || "";
  }

  checkDocumentIsMarkdown(showWarning: boolean): boolean {
    let result = this.getDocumentType() === "markdown";
    if (!result && showWarning) {
      vscode.window.showInformationMessage(Constants.ErrorMessages.NO_MARKDOWN);
    }
    return result;
  }

  async initMarkdownPreview(viewColumn: number) {
    let proceed = this.checkDocumentIsMarkdown(true);
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
            vscode.Uri.file(
              path.join(this.context.extensionPath, "out", "app")
            ),
            vscode.Uri.file(path.join(this.context.extensionPath, "assets")),
            vscode.Uri.file(path.join(vscode.workspace?.rootPath || "")),
          ],
        }
      );

      this.panel.iconPath = this.iconPath;
      this._disposed = false;

      this.panel.webview.html = this.getWebviewContent();

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

      this.panel.webview.onDidReceiveMessage((m: Message) => {
        if (m.type === "SCROLL_FROM_WEBVIEW") {
          this.onDidScrollPreview(m.payload.line);
        } else if (m.type === "OPEN") {
          const hasExtension = m.payload.path.split(".").length > 1;
          if (!hasExtension) {
            m.payload.path += ".md";
          }

          return vscode.workspace
            .openTextDocument(
              vscode.Uri.file(
                path.join(
                  vscode.workspace.rootPath || "",
                  m.payload.rootFolder || "",
                  m.payload.path
                )
              )
            )
            .then((doc) => {
              vscode.window.showTextDocument(doc);
            });
        } else if (m.type === "WRITE") {
          const hasExtension = m.payload.path.split(".").length > 1;
          if (!hasExtension) {
            m.payload.path += ".md";
          }

          return vscode.workspace.fs.writeFile(
            vscode.Uri.file(
              path.join(
                vscode.workspace.rootPath || "",
                m.payload.rootFolder || "",
                m.payload.path
              )
            ),
            Buffer.from(m.payload.content, "utf8")
          );
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
    const root = path.join(this.context.extensionPath, "assets/icons");
    return {
      light: vscode.Uri.file(path.join(root, "Preview.svg")),
      dark: vscode.Uri.file(path.join(root, "Preview_inverse.svg")),
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
