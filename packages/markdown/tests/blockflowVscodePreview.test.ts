import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  DownloadableElement,
  HyperbookContext,
  HyperbookJson,
  elementCoreFiles,
  elementRuntimeFiles,
} from "@hyperbook/types";
import { expect, it } from "vitest";

const vscodePlatform = new URL("../../../platforms/vscode/", import.meta.url);
const elements = Object.keys(elementCoreFiles) as DownloadableElement[];

/** Renders the active document with the extension's Preview and a stubbed VS Code. */
async function renderPreview({
  existing = () => true,
  config = { name: "Test" },
}: {
  existing?: (file: string) => boolean;
  config?: HyperbookJson;
} = {}): Promise<HyperbookContext> {
  const source = readFileSync(
    new URL("src/Preview.ts", vscodePlatform),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  let ctx: HyperbookContext | undefined;
  const file = {
    root: "/workspace",
    markdown: { content: "", data: {} },
    path: { href: "/lesson/index", directory: "lesson" },
  };
  const publicFile = {
    folder: "public",
    path: { href: "/project.sb3", relative: "project.sb3" },
  };
  const vscode = {
    languages: { createDiagnosticCollection: () => ({}) },
    workspace: { getConfiguration: () => ({}) },
    window: {
      activeTextEditor: {
        document: {
          uri: { fsPath: "/workspace/book/lesson/index.md" },
          fileName: "index.md",
        },
      },
    },
    Uri: {
      joinPath: (...parts: string[]) => path.posix.join(...parts),
      file: (p: string) => p,
    },
  };
  const filesystem = {
    hyperbook: {
      findRoot: async () => "/workspace",
      getPagesAndSections: async () => ({
        pages: [],
        sections: [],
        glossary: [],
      }),
      getPageList: () => [],
      getNavigationForFile: async () => ({
        current: { href: "/lesson/index", path: { directory: "lesson" } },
      }),
    },
    vfile: {
      get: async () => file,
      list: async () => [],
      listForFolder: async () => [publicFile],
    },
    getPasswords: async () => ({ passwords: {} }),
  };
  const modules: Record<string, unknown> = {
    vscode,
    path: path.posix,
    fs: { existsSync: existing },
    "@hyperbook/fs": filesystem,
    "@hyperbook/types": {
      elementRuntimeFiles,
      isExternalUrl: (p: string) => /^https?:\/\//.test(p),
    },
    "@hyperbook/markdown": {
      process: async (_content: string, context: HyperbookContext) => {
        ctx = context;
        return "";
      },
    },
  };
  const exports: any = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => modules[name] || {},
  });
  const preview = Object.create(exports.default.prototype);
  preview.context = { extensionUri: "/extension", extensionPath: "/extension" };
  preview.panel = {
    webview: {
      asWebviewUri: (p: string) => ({
        toString: () => `https://file+.vscode-resource.vscode-cdn.net${p}`,
      }),
    },
  };
  preview.checkDocumentIsHyperbookFile = () => true;
  preview.getConfig = async () => config;
  preview.publishDiagnostics = () => {};
  await preview.handleTextDocumentChange();
  return ctx!;
}

it("uses valid VS Code resource URLs for the bundle and local projects", async () => {
  const ctx = await renderPreview();

  const asset = ctx.makeUrl(["directive-blockflow", "editor.html"], "assets");
  expect(asset).toBe(
    "https://file+.vscode-resource.vscode-cdn.net/extension/assets/hyperbook/directive-blockflow/editor.html",
  );
  expect(
    new URL(asset, "https://preview.vscode-webview.net/index.html").hostname,
  ).toBe("file+.vscode-resource.vscode-cdn.net");
  expect(ctx.makeUrl("/project.sb3", "public")).toBe(
    "https://file+.vscode-resource.vscode-cdn.net/workspace/public/project.sb3",
  );
});

it("keeps local runtimes when the extension ships them", async () => {
  const config = { name: "Test", elements: { pyide: { cdn: false } } };
  const ctx = await renderPreview({ config });
  expect(ctx.config).toEqual(config);
});

it("loads runtimes missing from the extension from their CDN", async () => {
  const ctx = await renderPreview({
    existing: (file) => !file.includes("/directive-pyide/"),
    config: {
      name: "Test",
      elements: { pyide: { cdn: false }, typst: { cdn: false } },
    },
  });
  expect(ctx.config.elements?.pyide).toEqual({ cdn: true });
  expect(ctx.config.elements?.typst).toEqual({ cdn: false });
});

it("keeps a book's own CDN and element settings", async () => {
  const ctx = await renderPreview({
    existing: () => false,
    config: {
      name: "Test",
      elements: {
        typst: { cdn: "https://assets.example.com/typst/" },
        onlineide: { height: 400 },
      },
    },
  });
  for (const element of elements)
    expect(ctx.config.elements?.[element]?.cdn).toBeTruthy();
  expect(ctx.config.elements?.typst?.cdn).toBe(
    "https://assets.example.com/typst/",
  );
  expect(ctx.config.elements?.onlineide).toEqual({ height: 400, cdn: true });
});

it("leaves large element runtimes out of the VS Code package", async () => {
  const require = createRequire(new URL("package.json", vscodePlatform));
  const vsce = require("@vscode/vsce");
  const fixture = mkdtempSync(path.join(tmpdir(), "hyperbook-vsix-"));
  try {
    for (const name of ["package.json", ".vscodeignore"])
      writeFileSync(
        path.join(fixture, name),
        readFileSync(new URL(name, vscodePlatform)),
      );
    const write = (file: string) => {
      mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
      writeFileSync(path.join(fixture, file), "");
    };
    write("out/extension.js");
    write("assets/hyperbook/directive-alert/client.js");
    for (const element of elements)
      for (const file of [
        ...elementCoreFiles[element],
        ...elementRuntimeFiles[element],
      ])
        write(`assets/hyperbook/directive-${element}/${file}`);

    const files: string[] = await vsce.listFiles({
      cwd: fixture,
      packageManager: vsce.PackageManager.None,
    });
    expect(files).toContain("out/extension.js");
    expect(files).toContain("assets/hyperbook/directive-alert/client.js");
    for (const element of elements) {
      for (const file of elementCoreFiles[element])
        expect(files).toContain(
          `assets/hyperbook/directive-${element}/${file}`,
        );
      for (const file of elementRuntimeFiles[element])
        expect(files).not.toContain(
          `assets/hyperbook/directive-${element}/${file}`,
        );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 60_000);
