import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { HyperbookContext } from "@hyperbook/types";
import { expect, it } from "vitest";

it("uses valid VS Code resource URLs for the bundle and local projects", async () => {
  const source = readFileSync(
    new URL("../../../platforms/vscode/src/Preview.ts", import.meta.url),
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
    path,
    "@hyperbook/fs": filesystem,
    "@hyperbook/types": {
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
  preview.context = { extensionUri: "/extension" };
  preview.panel = {
    webview: {
      asWebviewUri: (p: string) => ({
        toString: () => `https://file+.vscode-resource.vscode-cdn.net${p}`,
      }),
    },
  };
  preview.checkDocumentIsHyperbookFile = () => true;
  preview.getConfig = async () => ({ name: "Test" });
  preview.publishDiagnostics = () => {};
  await preview.handleTextDocumentChange();

  const asset = ctx!.makeUrl(["directive-blockflow", "editor.html"], "assets");
  expect(asset).toBe(
    "https://file+.vscode-resource.vscode-cdn.net/extension/assets/hyperbook/directive-blockflow/editor.html",
  );
  expect(
    new URL(asset, "https://preview.vscode-webview.net/index.html").hostname,
  ).toBe("file+.vscode-resource.vscode-cdn.net");
  expect(ctx!.makeUrl("/project.sb3", "public")).toBe(
    "https://file+.vscode-resource.vscode-cdn.net/workspace/public/project.sb3",
  );
});
