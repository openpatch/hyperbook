import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  DownloadableElement,
  HyperbookContext,
  HyperbookJson,
  elementCoreFiles,
  elementCdn,
  elementRuntimeFiles,
} from "@hyperbook/types";
import { expect, it } from "vitest";

const vscodePlatform = new URL("../../../platforms/vscode/", import.meta.url);
const elements = Object.keys(elementCoreFiles) as DownloadableElement[];

it("loads the compiled extension in a Node extension host", () => {
  execFileSync(
    process.execPath,
    [
      "-e",
      `
        const fs = require('node:fs');
        const Module = require('node:module');
        const filename = process.argv[1];
        const extension = new Module(filename);
        extension.filename = filename;
        extension.paths = Module._nodeModulePaths(require('node:path').dirname(filename));
        const vscode = { languages: { createDiagnosticCollection: () => ({}) } };
        extension.require = name => name === 'vscode'
          ? vscode : Module.prototype.require.call(extension, name);
        try {
          extension._compile(fs.readFileSync(filename, 'utf8'), filename);
          if (typeof extension.exports.activate !== 'function')
            throw new Error('The compiled extension does not export activate.');
        } catch (error) {
          console.error(error.message);
          process.exitCode = 1;
        }
      `,
      fileURLToPath(new URL("out/extension.js", vscodePlatform)),
    ],
    { stdio: "pipe" },
  );
});

type RuntimeLocation =
  | { kind: "bundled" }
  | { kind: "cached"; directory: string }
  | { kind: "missing" };

/** Renders the active document with the extension's Preview and a stubbed VS Code. */
async function renderPreview({
  locate = () => ({ kind: "bundled" }),
  config = { name: "Test" },
  directives = {},
  renders = 1,
}: {
  locate?: (element: DownloadableElement) => RuntimeLocation;
  config?: HyperbookJson;
  directives?: Record<string, unknown>;
  renders?: number;
} = {}): Promise<{ ctx: HyperbookContext; messages: string[] }> {
  const messages: string[] = [];
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
    commands: { executeCommand: () => {} },
    workspace: { getConfiguration: () => ({}) },
    window: {
      showInformationMessage: async (message: string) => {
        messages.push(message);
      },
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
    "./RuntimeAssets": {
      runtimeElements: elements,
      runtimeLabels: Object.fromEntries(elements.map((e) => [e, `<${e}>`])),
    },
    "@hyperbook/fs": filesystem,
    "@hyperbook/types": {
      elementCdn,
      isExternalUrl: (p: string) => /^https?:\/\//.test(p),
    },
    "@hyperbook/markdown": {
      process: async (_content: string, context: HyperbookContext) => {
        ctx = context;
        return { data: { directives } };
      },
    },
  };
  const exports: any = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => modules[name] || {},
  });
  const preview = Object.create(exports.default.prototype);
  preview.context = { extensionUri: "/extension" };
  // Object.create skips the constructor and its field initializers.
  preview.offeredDownloads = new Set();
  preview.runtimes = { locate: async (e: DownloadableElement) => locate(e) };
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
  for (let i = 0; i < renders; i++) await preview.handleTextDocumentChange();
  return { ctx: ctx!, messages };
}

it("uses valid VS Code resource URLs for the bundle and local projects", async () => {
  const { ctx } = await renderPreview();

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
  const { ctx } = await renderPreview({ config });
  expect(ctx.config).toEqual(config);
});

it("uses Pyodide's default CDN even when its local runtime is cached", async () => {
  const located: DownloadableElement[] = [];
  const { ctx, messages } = await renderPreview({
    locate: (element) => {
      located.push(element);
      return {
        kind: "cached",
        directory: `/cache/hash/content-1/directive-${element}`,
      };
    },
    directives: { pyide: {} },
  });
  expect(located).not.toContain("pyide");
  expect(elementCdn(ctx.config, "pyide")).toBe(true);
  expect(messages).toEqual([]);
});

it("uses runtimes from the CLI asset cache", async () => {
  const { ctx, messages } = await renderPreview({
    locate: (element) =>
      element === "pyide" || element === "typst"
        ? {
            kind: "cached",
            directory: `/cache/hash/content-1/directive-${element}`,
          }
        : { kind: "bundled" },
    config: { name: "Test", elements: { pyide: { cdn: false } } },
    directives: { pyide: {}, typst: {} },
  });
  const cache =
    "https://file+.vscode-resource.vscode-cdn.net/cache/hash/content-1";
  expect(ctx.config.elements?.pyide).toEqual({
    cdn: `${cache}/directive-pyide/pyodide/`,
  });
  expect(ctx.config.elements?.typst).toEqual({
    cdn: `${cache}/directive-typst/`,
  });
  expect(ctx.config.elements?.geogebra).toBeUndefined();
  expect(messages).toEqual([]);
});

it("loads runtimes that are not downloaded from their CDN and offers a download once", async () => {
  const { ctx, messages } = await renderPreview({
    locate: () => ({ kind: "missing" }),
    directives: { pyide: {}, "blockflow-player": {}, alert: {} },
    renders: 2,
  });
  for (const element of elements)
    expect(elementCdn(ctx.config, element)).toBe(true);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain("<blockflow>");
  expect(messages[0]).not.toContain("<pyide>");
  expect(messages[0]).not.toContain("<typst>");
});

it("keeps a book's own CDN and element settings, like a Hyperbook build", async () => {
  const located: DownloadableElement[] = [];
  const { ctx, messages } = await renderPreview({
    locate: (element) => {
      located.push(element);
      return { kind: "missing" };
    },
    config: {
      name: "Test",
      elements: {
        typst: { cdn: "https://assets.example.com/typst/" },
        geogebra: { cdn: true },
        onlineide: { height: 400 },
      },
    },
    directives: { typst: {}, geogebra: {} },
  });
  expect(ctx.config.elements?.typst?.cdn).toBe(
    "https://assets.example.com/typst/",
  );
  expect(located).not.toContain("typst");
  expect(located).not.toContain("geogebra");
  expect(ctx.config.elements?.onlineide).toEqual({ height: 400, cdn: true });
  // The book chose these CDNs, so there is nothing to download.
  expect(messages).toEqual([]);
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
    write("out/asset-manifest.json");
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
    expect(files).toContain("out/asset-manifest.json");
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
