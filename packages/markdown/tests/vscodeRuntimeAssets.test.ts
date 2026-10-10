import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { create } from "tar";
import * as hyperbookFs from "@hyperbook/fs";
import * as types from "@hyperbook/types";
import { afterEach, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../../platforms/vscode/src/RuntimeAssets.ts", import.meta.url),
  "utf8",
);

let root: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

/** The extension's RuntimeAssets with a stubbed VS Code API. */
function loadRuntimeAssets(messages: string[]) {
  const vscode = {
    EventEmitter: class {
      listeners: (() => void)[] = [];
      event = (listener: () => void) => this.listeners.push(listener);
      fire() {
        this.listeners.forEach((listener) => listener());
      }
    },
    ProgressLocation: { Notification: 15 },
    window: {
      withProgress: (_options: unknown, task: any) =>
        task({ report: () => {} }),
      showInformationMessage: (message: string) => messages.push(message),
      showErrorMessage: (message: string) => messages.push(message),
    },
  };
  const modules: Record<string, unknown> = {
    vscode,
    path,
    "@hyperbook/fs": hyperbookFs,
    "@hyperbook/types": types,
  };
  const exports: any = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: (name: string) => modules[name] },
  );
  return exports.default;
}

it("shares verified runtimes with the CLI's asset cache", async () => {
  root = mkdtempSync(path.join(tmpdir(), "hyperbook-vscode-runtimes-"));
  const cacheDir = path.join(root, "cache");
  vi.stubEnv("HYPERBOOK_ASSET_CACHE", cacheDir);

  // An installed extension: integration files only, plus the CLI manifest.
  const extension = path.join(root, "extension");
  const core = path.join(extension, "assets", "hyperbook", "directive-pyide");
  mkdirSync(core, { recursive: true });
  writeFileSync(path.join(core, "client.js"), "client");

  // The runtime bundle a CLI release publishes.
  const content = path.join(root, "content");
  const runtime = path.join(content, "directive-pyide", "pyodide");
  mkdirSync(runtime, { recursive: true });
  writeFileSync(path.join(runtime, "pyodide.js"), "pyodide");
  writeFileSync(path.join(runtime, "pyodide-lock.json"), "{}");
  const files = {
    "directive-pyide/pyodide/pyodide-lock.json": 2,
    "directive-pyide/pyodide/pyodide.js": 7,
  };
  const archive = path.join(root, "pyide.tar.gz");
  await create(
    { file: archive, cwd: content, gzip: true, portable: true, noMtime: true },
    Object.keys(files),
  );
  const manifest = {
    format: 1,
    version: "1.0.0",
    bundles: {
      pyide: {
        url: "https://example.invalid/pyide.tar.gz",
        sha256: createHash("sha256")
          .update(readFileSync(archive))
          .digest("hex"),
        bytes: statSync(archive).size,
        files,
      },
    },
  };
  mkdirSync(path.join(extension, "out"));
  writeFileSync(
    path.join(extension, "out", "asset-manifest.json"),
    JSON.stringify(manifest),
  );

  const messages: string[] = [];
  const RuntimeAssets = loadRuntimeAssets(messages);
  const runtimes = new RuntimeAssets(extension);
  expect(runtimes.cacheDir).toBe(cacheDir);
  expect(await runtimes.locate("pyide")).toEqual({ kind: "missing" });
  expect(await runtimes.locate("typst")).toEqual({ kind: "missing" });

  // Serve the download from the verified archive instead of the network.
  const fetch = vi.fn(async () => new Response(readFileSync(archive)));
  vi.stubGlobal("fetch", fetch);
  let changed = 0;
  runtimes.onDidChange(() => changed++);
  expect(await runtimes.download(["pyide"])).toBe(true);
  vi.unstubAllGlobals();
  expect(fetch).toHaveBeenCalledWith(
    manifest.bundles.pyide.url,
    expect.anything(),
  );
  expect(changed).toBe(1);

  const location = await runtimes.locate("pyide");
  expect(location.kind).toBe("cached");
  expect(location.directory.startsWith(cacheDir)).toBe(true);
  expect(
    readFileSync(
      path.join(location.directory, "pyodide", "pyodide.js"),
      "utf8",
    ),
  ).toBe("pyodide");

  // The CLI finds the same bundle offline, so neither downloads it twice.
  const cli = new hyperbookFs.AssetManager({
    offline: true,
    cacheDir,
    assetsPath: path.join(root, "cli-assets"),
    manifestPath: path.join(extension, "out", "asset-manifest.json"),
    bundlesPath: path.join(root, "cli-bundles"),
  });
  expect(await cli.ensure("pyide")).toBe(location.directory);

  // A runtime the extension ships counts as bundled.
  const bundled = path.join(
    extension,
    "assets",
    "hyperbook",
    "directive-typst",
  );
  mkdirSync(path.join(bundled, "fonts"), { recursive: true });
  for (const file of types.elementRuntimeFiles.typst)
    writeFileSync(path.join(bundled, file), "");
  expect(await runtimes.locate("typst")).toEqual({ kind: "bundled" });
});

it("reports runtimes it cannot download", async () => {
  root = mkdtempSync(path.join(tmpdir(), "hyperbook-vscode-runtimes-"));
  vi.stubEnv("HYPERBOOK_ASSET_CACHE", path.join(root, "cache"));
  const messages: string[] = [];
  const RuntimeAssets = loadRuntimeAssets(messages);
  // No manifest: for example a development build without the CLI.
  const runtimes = new RuntimeAssets(path.join(root, "extension"));
  expect(await runtimes.download(["geogebra"])).toBe(false);
  expect(messages.at(-1)).toContain("GeoGebra");
  expect(await runtimes.locate("geogebra")).toEqual({ kind: "missing" });
});
