import * as vscode from "vscode";
import * as path from "path";
import Preview from "./Preview";
import StatusBarItem from "./StatusBarItem";
import { hyperbook } from "@hyperbook/fs";
import { createNewHyperbook } from "./NewCommand";

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

  let disposableDevServer = vscode.commands.registerCommand(
    "hyperbook.startDevServer",
    async () => {
      const terminal = vscode.window.createTerminal("Hyperbook");
      terminal.show();
      terminal.sendText("npx hyperbook dev");
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
      const hyperbookRoot = await hyperbook.findRoot(
        workspaceFolder.uri.fsPath,
      );

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
      const hyperbookRoot = await hyperbook.findRoot(
        workspaceFolder.uri.fsPath,
      );

      if (!hyperbookRoot) {
        vscode.window.showErrorMessage(
          "No Hyperbook project found. Please create one first using 'Create new Hyperbook'.",
        );
        return;
      }

      const pageName = await vscode.window.showInputBox({
        prompt:
          "Enter the name for your new page (e.g., 'getting-started' or 'chapter1/section1')",
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
name: ${path
          .basename(pageName)
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")}
---

# ${path
          .basename(pageName)
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")}

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
      vscode.env.openExternal(
        vscode.Uri.parse("https://hyperbook.openpatch.org"),
      );
    },
  );

  let disposableNew = vscode.commands.registerCommand(
    "hyperbook.new",
    async () => {
      await createNewHyperbook(context);
    },
  );

  // push to subscriptions list so that they are disposed automatically
  // HTML Preview:
  context.subscriptions.push(disposableSidePreview);
  context.subscriptions.push(disposableDevServer);
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

  // Helper function to get hyperbook root with caching
  const rootCache = new Map<string, string>();
  async function getHyperbookRoot(
    docPath: string,
  ): Promise<string | undefined> {
    if (rootCache.has(docPath)) {
      return rootCache.get(docPath);
    }
    const root = await hyperbook.findRoot(docPath);
    if (root) {
      rootCache.set(docPath, root);
    }
    return root;
  }

  // Helper function to create file completion items
  function createFileCompletionItems(
    files: vscode.Uri[],
    baseFolder: string,
    stripExtension: boolean = false,
  ): vscode.CompletionItem[] {
    return files.map((f) => {
      const p = path.relative(baseFolder, f.path);
      const { dir, name, ext } = path.parse(p);
      const item = new vscode.CompletionItem(
        stripExtension && name !== "index" ? path.join(dir, name) : p,
        vscode.CompletionItemKind.File,
      );
      item.detail = stripExtension ? `Page: ${p}` : `File: ${p}`;
      item.insertText =
        stripExtension && name !== "index"
          ? dir
            ? path.join(dir, name)
            : name
          : dir && name === "index"
            ? dir
            : p;
      return item;
    });
  }

  // Helper to create completion items with multiple path formats
  function createMultiPathCompletionItems(
    files: vscode.Uri[],
    currentDocPath: string,
    hyperbookRoot: string,
    publicFolder: string,
    bookFolder: string,
    addPrefix: boolean = false,
    position?: vscode.Position,
    linePrefix?: string,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const currentDir = path.dirname(currentDocPath);

    // Calculate the range to replace if position and linePrefix are provided
    let replaceRange: vscode.Range | undefined;
    if (position && linePrefix) {
      const srcMatch = linePrefix.match(/(?:src|thumbnail|poster)=\"([^"]*)$/);
      if (srcMatch) {
        const startChar = position.character - srcMatch[1].length;
        replaceRange = new vscode.Range(
          position.line,
          startChar,
          position.line,
          position.character,
        );
      }
    }

    files.forEach((f) => {
      const filePath = f.path;

      // Relative to public (absolute path with /)
      if (filePath.startsWith(publicFolder)) {
        const publicRel = path.relative(publicFolder, filePath);
        const item = new vscode.CompletionItem(
          addPrefix ? "/" + publicRel : publicRel,
          vscode.CompletionItemKind.File,
        );
        item.detail = `Public: /${publicRel}`;
        item.insertText = addPrefix ? "/" + publicRel : publicRel;
        item.sortText = "0_" + publicRel; // Sort public paths first
        if (replaceRange) {
          item.range = replaceRange;
        }
        items.push(item);
      }

      // Relative to book (absolute path with /)
      if (filePath.startsWith(bookFolder)) {
        const bookRel = path.relative(bookFolder, filePath);
        const item = new vscode.CompletionItem(
          addPrefix ? "/" + bookRel : bookRel,
          vscode.CompletionItemKind.File,
        );
        item.detail = `Book: /${bookRel}`;
        item.insertText = addPrefix ? "/" + bookRel : bookRel;
        item.sortText = "1_" + bookRel;
        if (replaceRange) {
          item.range = replaceRange;
        }
        items.push(item);
      }

      // Relative to current document (./  or ../)
      if (filePath.startsWith(bookFolder)) {
        const relPath = path.relative(currentDir, filePath);
        if (
          !relPath.startsWith("..") ||
          relPath.split(path.sep).filter((s) => s === "..").length <= 3
        ) {
          const normalizedRel = relPath.startsWith(".")
            ? relPath
            : "./" + relPath;
          const item = new vscode.CompletionItem(
            normalizedRel,
            vscode.CompletionItemKind.File,
          );
          item.detail = `Relative: ${normalizedRel}`;
          item.insertText = normalizedRel;
          item.sortText = "2_" + relPath;
          if (replaceRange) {
            item.range = replaceRange;
          }
          items.push(item);
        }
      }
    });

    return items;
  }

  const bookProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);

        // Trigger on / for paths and after [ for links
        const isPath = linePrefix.endsWith("/");
        const isLink = linePrefix.match(/\[[^\]]*$/);

        if (!isPath && !isLink) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "book/**/*.md"),
        );

        return createFileCompletionItems(
          files,
          path.join(workspaceFolder, "book"),
          true,
        );
      },
    },
    "/",
    "[",
  );

  const publicProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);

        // Match various src patterns
        const srcMatch = linePrefix.match(/(?:src|thumbnail|poster)=\"([^"]*)/);
        const isSlash = linePrefix.endsWith("/");

        if (!srcMatch && !isSlash) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        // Determine if we should show relative paths based on context
        const showRelative = srcMatch && !srcMatch[1].startsWith("/");

        // Search in both public and book folders
        const publicFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "public/**"),
        );
        const bookFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "book/**"),
        );

        const allFiles = [...publicFiles, ...bookFiles];

        if (showRelative) {
          return createMultiPathCompletionItems(
            allFiles,
            document.uri.path,
            workspaceFolder,
            path.join(workspaceFolder, "public"),
            path.join(workspaceFolder, "book"),
            true,
            position,
            linePrefix,
          );
        } else {
          // Only show absolute paths
          const items = allFiles.map((f) => {
            let p: string;
            let detail: string;

            if (f.path.startsWith(path.join(workspaceFolder, "public"))) {
              p = path.relative(path.join(workspaceFolder, "public"), f.path);
              detail = `Public: /${p}`;
            } else {
              p = path.relative(path.join(workspaceFolder, "book"), f.path);
              detail = `Book: /${p}`;
            }

            const item = new vscode.CompletionItem(
              "/" + p,
              vscode.CompletionItemKind.File,
            );
            item.detail = detail;
            item.insertText = "/" + p;

            // Add file type icons
            const ext = path.extname(p).toLowerCase();
            if (
              [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)
            ) {
              item.kind = vscode.CompletionItemKind.Color;
            } else if ([".mp3", ".wav", ".ogg"].includes(ext)) {
              item.kind = vscode.CompletionItemKind.Event;
            } else if ([".mp4", ".webm", ".ogv"].includes(ext)) {
              item.kind = vscode.CompletionItemKind.Event;
            }

            return item;
          });

          return items;
        }
      },
    },
    "/",
    '"',
  );

  const glossaryProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const findTerm = linePrefix.match(/:(t|term)\[([^\]]*)\]{#/);
        if (!findTerm) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "glossary/**/*.md"),
        );

        return files.map((f) => {
          const p = path.relative(
            path.join(workspaceFolder, "glossary"),
            f.path,
          );
          const { name, dir } = path.parse(p);
          const item = new vscode.CompletionItem(
            name,
            vscode.CompletionItemKind.Reference,
          );
          item.detail = `Glossary term: ${dir ? dir + "/" : ""}${name}`;
          item.insertText = name;
          return item;
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
        const findTerm = linePrefix.match(/:(archive)\[([^\]]*)\]{\s*name=\"/);
        if (!findTerm) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        try {
          const archivePath = vscode.Uri.file(
            path.join(workspaceFolder, "archives"),
          );
          const files = await vscode.workspace.fs.readDirectory(archivePath);

          return files
            .filter(([_, type]) => type === vscode.FileType.Directory)
            .map(([file]) => {
              const { name } = path.parse(file);
              const item = new vscode.CompletionItem(
                name,
                vscode.CompletionItemKind.Folder,
              );
              item.detail = `Archive: ${name}`;
              return item;
            });
        } catch {
          return undefined;
        }
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
        const findTerm = linePrefix.match(/:(h5p)(?:\[[^\]]*\])?\{\s*src=\"/);
        if (!findTerm) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "public/**/*.h5p"),
        );

        return files.map((f) => {
          const p = path.relative(path.join(workspaceFolder, "public"), f.path);
          const item = new vscode.CompletionItem(
            "/" + p,
            vscode.CompletionItemKind.File,
          );
          item.detail = `H5P: ${p}`;
          item.insertText = "/" + p;
          return item;
        });
      },
    },
    '"',
  );

  // New: Learningmap file completion
  const learningmapProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const match = linePrefix.match(/:(learningmap)\{[^}]*src=\"/);
        if (!match) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        // Search in both public and book folders
        const publicFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(
            workspaceFolder,
            "public/**/*.learningmap",
          ),
        );
        const bookFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "book/**/*.learningmap"),
        );

        const allFiles = [...publicFiles, ...bookFiles];

        return createMultiPathCompletionItems(
          allFiles,
          document.uri.path,
          workspaceFolder,
          path.join(workspaceFolder, "public"),
          path.join(workspaceFolder, "book"),
          true,
        );
      },
    },
    '"',
  );

  // New: Excalidraw file completion
  const excalidrawProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const match = linePrefix.match(/:(excalidraw)\{[^}]*src=\"/);
        if (!match) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        // Search in both public and book folders
        const publicFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "public/**/*.excalidraw"),
        );
        const bookFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "book/**/*.excalidraw"),
        );

        const allFiles = [...publicFiles, ...bookFiles];

        return createMultiPathCompletionItems(
          allFiles,
          document.uri.path,
          workspaceFolder,
          path.join(workspaceFolder, "public"),
          path.join(workspaceFolder, "book"),
          true,
          position,
          linePrefix,
        );
      },
    },
    '"',
  );

  // New: Media files completion (audio/video)
  const mediaProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const match = linePrefix.match(
          /:(audio|video)(?:\[[^\]]*\])?\{[^}]*(?:src|thumbnail|poster)=\"/,
        );
        if (!match) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        const mediaExtensions =
          match[1] === "audio"
            ? "**/*.{mp3,wav,ogg,m4a,flac}"
            : "**/*.{mp4,webm,ogv,mov}";

        // Search in both public and book folders
        const publicFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(
            workspaceFolder,
            `public/${mediaExtensions}`,
          ),
        );
        const bookFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(
            workspaceFolder,
            `book/${mediaExtensions}`,
          ),
        );

        const allFiles = [...publicFiles, ...bookFiles];

        return createMultiPathCompletionItems(
          allFiles,
          document.uri.path,
          workspaceFolder,
          path.join(workspaceFolder, "public"),
          path.join(workspaceFolder, "book"),
          true,
          position,
          linePrefix,
        );
      },
    },
    '"',
  );

  // New: Download file completion
  const downloadProvider = vscode.languages.registerCompletionItemProvider(
    DocumentSelectorMarkdown,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);
        const match = linePrefix.match(/:(download)\[[^\]]*\]\{[^}]*src=\"/);
        if (!match) {
          return undefined;
        }

        const workspaceFolder = await getHyperbookRoot(document.uri.path);
        if (!workspaceFolder) {
          return undefined;
        }

        // Search in both public and book folders
        const publicFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "public/**"),
        );
        const bookFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "book/**"),
        );

        const allFiles = [...publicFiles, ...bookFiles].filter(
          (f) => !f.path.endsWith(".md") && !f.path.endsWith(".hbs"),
        );

        return createMultiPathCompletionItems(
          allFiles,
          document.uri.path,
          workspaceFolder,
          path.join(workspaceFolder, "public"),
          path.join(workspaceFolder, "book"),
          true,
          position,
          linePrefix,
        );
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
    learningmapProvider,
    excalidrawProvider,
    mediaProvider,
    downloadProvider,
  );
}

// This method is called when extension is deactivated
export function deactivate() {}
