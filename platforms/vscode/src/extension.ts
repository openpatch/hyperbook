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

  // Command: Create new Hyperbook
  let disposableNew = vscode.commands.registerCommand(
    "hyperbook.new",
    async () => {
      const terminal = vscode.window.createTerminal("Hyperbook");
      terminal.show();
      terminal.sendText("npx hyperbook new");
    },
  );

  // Command: Open index.md
  let disposableOpenIndexMd = vscode.commands.registerCommand(
    "hyperbook.openIndexMd",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          "No workspace folder open. Please open a Hyperbook project first.",
        );
        return;
      }

      const workspaceFolder = workspaceFolders[0];
      const hyperbookRoot = await hyperbook.findRoot(workspaceFolder.uri.fsPath);

      if (!hyperbookRoot) {
        vscode.window.showErrorMessage(
          "No Hyperbook project found. Please create one first using 'Create new Hyperbook'.",
        );
        return;
      }

      const indexPath = path.join(hyperbookRoot, "book", "index.md");
      try {
        const doc = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Could not open index.md: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // Command: Create new page
  let disposableCreateNewPage = vscode.commands.registerCommand(
    "hyperbook.createNewPage",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          "No workspace folder open. Please open a Hyperbook project first.",
        );
        return;
      }

      const workspaceFolder = workspaceFolders[0];
      const hyperbookRoot = await hyperbook.findRoot(workspaceFolder.uri.fsPath);

      if (!hyperbookRoot) {
        vscode.window.showErrorMessage(
          "No Hyperbook project found. Please create one first using 'Create new Hyperbook'.",
        );
        return;
      }

      const pageName = await vscode.window.showInputBox({
        prompt: "Enter the name for your new page (e.g., 'getting-started' or 'chapter1/section1')",
        placeHolder: "page-name",
        validateInput: (value) => {
          if (!value) {
            return "Page name cannot be empty";
          }
          if (!/^[a-z0-9\-\/]+$/i.test(value)) {
            return "Page name can only contain letters, numbers, hyphens, and forward slashes";
          }
          return null;
        },
      });

      if (!pageName) {
        return;
      }

      const bookPath = path.join(hyperbookRoot, "book");
      const fullPath = path.join(bookPath, `${pageName}.md`);
      const dirPath = path.dirname(fullPath);

      try {
        // Create directory if it doesn't exist
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

        // Create the file with a basic template
        const template = `---
name: ${path.basename(pageName).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
---

# ${path.basename(pageName).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}

Start writing your content here...
`;

        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(fullPath),
          Buffer.from(template, "utf8"),
        );

        // Open the newly created file
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(
          `Created new page: ${pageName}.md`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Could not create page: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // Command: Open documentation
  let disposableOpenDocumentation = vscode.commands.registerCommand(
    "hyperbook.openDocumentation",
    () => {
      vscode.env.openExternal(vscode.Uri.parse("https://hyperbook.openpatch.org"));
    },
  );

  // push to subscriptions list so that they are disposed automatically
  // HTML Preview:
  context.subscriptions.push(disposableSidePreview);
  context.subscriptions.push(disposableNew);
  context.subscriptions.push(disposableOpenIndexMd);
  context.subscriptions.push(disposableCreateNewPage);
  context.subscriptions.push(disposableOpenDocumentation);
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
