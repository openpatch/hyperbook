import * as vscode from "vscode";
import * as path from "path";
import Preview from "./Preview";
import StatusBarItem from "./StatusBarItem";
import { hyperbook } from "@hyperbook/fs";

export function activate(context: vscode.ExtensionContext) {
  let preview = new Preview(context);
  let statusBarItem = new StatusBarItem(context, preview);
  statusBarItem.updateStatusbar();

  // Subscribe so that the statusBarItem gets updated
  let disposableStatusBar = vscode.window.onDidChangeActiveTextEditor(
    statusBarItem.updateStatusbar,
    statusBarItem,
    context.subscriptions,
  );

  let disposableSidePreview = vscode.commands.registerCommand(
    "hyperbook.sidePreview",
    async () => {
      await preview.initMarkdownPreview(vscode.ViewColumn.Beside);
    },
  );

  // push to subscriptions list so that they are disposed automatically
  // HTML Preview:
  context.subscriptions.push(disposableSidePreview);
  context.subscriptions.push(disposableStatusBar);

  // Completions
  const DocumentSelectorMarkdown: vscode.DocumentSelector = [
    {
      language: "markdown",
      scheme: "file",
    },
    {
      language: "handlebars",
      scheme: "file",
    },
  ];

  const bookProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        if (!linePrefix.endsWith("/")) {
          return undefined;
        }

        const workspaceFolder = await hyperbook.findRoot(document.uri.path);

        if (!workspaceFolder) {
          return undefined;
        }

        return vscode.workspace
          .findFiles(new vscode.RelativePattern(workspaceFolder, "book/**"))
          .then((files) => {
            return files.map((f) => {
              const p = path.relative(
                path.join(workspaceFolder, "book"),
                f.path,
              );
              const { dir, name } = path.parse(p);
              return new vscode.CompletionItem(
                name !== "index" ? path.join(dir, name) : dir,
                vscode.CompletionItemKind.File,
              );
            });
          });
      },
    },
    "/",
  );

  const publicProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        if (!linePrefix.endsWith("/")) {
          return undefined;
        }

        const workspaceFolder = await hyperbook.findRoot(document.uri.path);

        if (!workspaceFolder) {
          return undefined;
        }

        return vscode.workspace
          .findFiles(new vscode.RelativePattern(workspaceFolder, "public/**"))
          .then((files) => {
            return files.map((f) => {
              const p = path.relative(
                path.join(workspaceFolder, "public"),
                f.path,
              );
              return new vscode.CompletionItem(
                p,
                vscode.CompletionItemKind.File,
              );
            });
          });
      },
    },
    "/",
  );

  const glossaryProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const findTerm = linePrefix.match(/.*:(t|term)\[.+\]{#/);
        if (findTerm === null) {
          return undefined;
        }

        const workspaceFolder = await hyperbook.findRoot(document.uri.path);

        if (!workspaceFolder) {
          return undefined;
        }

        return vscode.workspace
          .findFiles(new vscode.RelativePattern(workspaceFolder, "glossary/**"))
          .then((files) => {
            return files.map((f) => {
              const p = path.relative(
                path.join(workspaceFolder, "glossary"),
                f.path,
              );
              const { name } = path.parse(p);
              return new vscode.CompletionItem(
                name,
                vscode.CompletionItemKind.File,
              );
            });
          });
      },
    },
    "#",
  );

  const archiveProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const findTerm = linePrefix.match(/.*:(archive)\[.+\]{\s*name=\"/);
        if (findTerm === null) {
          return undefined;
        }

        const workspaceFolder = await hyperbook.findRoot(document.uri.path);

        if (!workspaceFolder) {
          return undefined;
        }

        return vscode.workspace.fs
          .readDirectory(
            vscode.Uri.parse(path.join(workspaceFolder, "archives")),
          )
          .then((files) => {
            return files
              .filter(([_, type]) => type === vscode.FileType.Directory)
              .map(([file]) => {
                const { name } = path.parse(file);
                return new vscode.CompletionItem(
                  name,
                  vscode.CompletionItemKind.Folder,
                );
              });
          });
      },
    },
    '"',
  );

  const h5pProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const findTerm = linePrefix.match(/.*:(h5p)\[.+\]{\s*src=\"/);
        if (findTerm === null) {
          return undefined;
        }

        const workspaceFolder = await hyperbook.findRoot(document.uri.path);

        if (!workspaceFolder) {
          return undefined;
        }

        return vscode.workspace
          .findFiles(new vscode.RelativePattern(workspaceFolder, "public/**"))
          .then((files) => {
            return files
              .filter((f) => f.path.endsWith(".h5p"))
              .map((f) => {
                const p = path.relative(
                  path.join(workspaceFolder, "public"),
                  f.path,
                );
                return new vscode.CompletionItem(
                  p,
                  vscode.CompletionItemKind.File,
                );
              });
          });
      },
    },
    '"',
  );

  context.subscriptions.push(
    bookProvider,
    publicProvider,
    glossaryProvider,
    archiveProvider,
    h5pProvider,
  );
}

// This method is called when extension is deactivated
export function deactivate() {}
