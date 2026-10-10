import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { create } from "tar";
import { Hyperproject } from "@hyperbook/types";
import { AssetManager, AssetOptions } from "../helpers/assets";
import { runBuildProject } from "../build";
import { IncrementalBuilder } from "../incremental";
import { fetchAssets, projectDirectives } from "../assets";

let root: string;
let project: Hyperproject;
let options: AssetOptions;
let download: ReturnType<typeof vi.fn>;
const player = '::blockflow-player{src="/game.sb3"}';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-assets-build-"));
  project = { name: "Assets", src: root, type: "book" };
  await fs.mkdir(path.join(root, "book"));
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({ name: "Assets", language: "en" }),
  );
  await fs.writeFile(path.join(root, "book", "index.md"), "# Hello\n");
  const input = path.join(root, "input");
  await fs.mkdir(path.join(input, "directive-blockflow"), { recursive: true });
  await fs.writeFile(
    path.join(input, "directive-blockflow", "player.html"),
    "player",
  );
  const archivePath = path.join(root, "bundle.tar.gz");
  await create({ file: archivePath, cwd: input, gzip: true }, [
    "directive-blockflow",
  ]);
  const archive = await fs.readFile(archivePath);
  options = {
    assetsPath: path.join(root, "core"),
    cacheDir: path.join(root, "cache"),
    manifestPath: path.join(root, "manifest.json"),
  };
  await fs.mkdir(options.assetsPath!);
  await fs.cp(
    path.join(__dirname, "..", "assets", "directive-blockflow-player"),
    path.join(options.assetsPath!, "directive-blockflow-player"),
    { recursive: true },
  );
  await fs.writeFile(
    options.manifestPath!,
    JSON.stringify({
      format: 1,
      version: "test",
      bundles: {
        blockflow: {
          url: "https://example.com/blockflow.tar.gz",
          sha256: createHash("sha256").update(archive).digest("hex"),
          bytes: archive.length,
          files: { "directive-blockflow/player.html": 6 },
        },
      },
    }),
  );
  download = vi.fn(async () => new Response(new Uint8Array(archive)));
  vi.stubGlobal("fetch", download);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

it("downloads the registered shared Blockflow dependency during a full build", async () => {
  await fs.writeFile(path.join(root, "book", "index.md"), player);
  await runBuildProject(
    project,
    project,
    undefined,
    undefined,
    undefined,
    new AssetManager(options),
  );
  const output = path.join(root, ".hyperbook", "out");
  expect(
    await fs.readFile(
      path.join(
        output,
        "__hyperbook_assets",
        "directive-blockflow",
        "player.html",
      ),
      "utf8",
    ),
  ).toBe("player");
  expect(await fs.readFile(path.join(output, "index.html"), "utf8")).toContain(
    "__hyperbook_assets/directive-blockflow/player.html",
  );
  expect(download).toHaveBeenCalledOnce();
});

it("builds and prefetches CDN elements offline without obtaining their local runtimes", async () => {
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({
      name: "Assets",
      elements: {
        blockflow: { cdn: true },
        pyide: { cdn: "https://cdn.example.com/python/" },
      },
    }),
  );
  await fs.writeFile(
    path.join(root, "book", "index.md"),
    `${player}\n\n::pyide`,
  );
  await fs.mkdir(path.join(options.assetsPath!, "directive-pyide"));
  await fs.writeFile(
    path.join(options.assetsPath!, "directive-pyide", "client.js"),
    "client",
  );
  const manager = new AssetManager({ ...options, offline: true });
  await fetchAssets(project, manager);
  await runBuildProject(
    project,
    project,
    undefined,
    undefined,
    undefined,
    manager,
  );
  const out = path.join(root, ".hyperbook", "out");
  const html = await fs.readFile(path.join(out, "index.html"), "utf8");
  expect(html).toContain("https://blockflow.openpatch.org/player.html");
  expect(html).toContain('data-runtime-url="https://cdn.example.com/python/"');
  await expect(
    fs.stat(path.join(out, "__hyperbook_assets", "directive-blockflow")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.stat(options.cacheDir!)).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(download).not.toHaveBeenCalled();
});

it("honors CDN configuration for a directive first added during incremental development", async () => {
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({
      name: "Assets",
      elements: { blockflow: { cdn: "http://cdn.example.com/blockflow" } },
    }),
  );
  const builder = new IncrementalBuilder(
    root,
    project,
    new AssetManager({ ...options, offline: true }),
  );
  await builder.initialize();
  await fs.writeFile(path.join(root, "book", "index.md"), player);
  await builder.handleChange(path.join("book", "index.md"), "change");
  expect(
    await fs.readFile(
      path.join(root, ".hyperbook", "out", "index.html"),
      "utf8",
    ),
  ).toContain("http://cdn.example.com/blockflow/player.html");
  expect(download).not.toHaveBeenCalled();
});

it("downloads a directive first introduced during an incremental build", async () => {
  const builder = new IncrementalBuilder(
    root,
    project,
    new AssetManager(options),
  );
  await builder.initialize();
  expect(download).not.toHaveBeenCalled();
  await fs.writeFile(
    path.join(root, "book", "index.md"),
    `# Hello\n\n${player}\n`,
  );
  await builder.handleChange(path.join("book", "index.md"), "change");
  expect(
    await fs.readFile(
      path.join(
        root,
        ".hyperbook",
        "out",
        "__hyperbook_assets",
        "directive-blockflow",
        "player.html",
      ),
      "utf8",
    ),
  ).toBe("player");
  expect(download).toHaveBeenCalledOnce();
});

it("recovers an incremental offline build after the missing assets are prefetched", async () => {
  const builder = new IncrementalBuilder(
    root,
    project,
    new AssetManager({ ...options, offline: true }),
  );
  await builder.initialize();
  await fs.writeFile(
    path.join(root, "book", "index.md"),
    `# Hello\n\n${player}\n`,
  );
  await expect(
    builder.handleChange(path.join("book", "index.md"), "change"),
  ).rejects.toThrow('Run "hyperbook assets fetch"');
  expect(download).not.toHaveBeenCalled();
  await fetchAssets(project, new AssetManager(options));
  await expect(
    builder.handleChange(path.join("book", "index.md"), "change"),
  ).resolves.toBeDefined();
  expect(download).toHaveBeenCalledOnce();
});

it("prefetches directives in a library's glossary, expanded snippets and templates without writing build output", async () => {
  await fs.mkdir(path.join(root, "glossary"));
  await fs.writeFile(path.join(root, "glossary", "game.md"), player);
  await fs.mkdir(path.join(root, "snippets"));
  await fs.writeFile(
    path.join(root, "snippets", "cad.md.hbs"),
    ":::openscad\n```openscad\ncube(10);\n```\n:::\n",
  );
  await fs.writeFile(
    path.join(root, "book", "index.md"),
    "# Hello\n\n:snippet{#cad}\n",
  );
  await fs.mkdir(path.join(root, "templates"));
  await fs.writeFile(
    path.join(root, "templates", "sketch.md.hbs"),
    '::excalidraw{src="{{source}}"}\n',
  );
  await fs.writeFile(
    path.join(root, "book", "sketch.md.json"),
    JSON.stringify({ template: "sketch", source: "/drawing.json" }),
  );
  const library: Hyperproject = {
    name: "Library",
    type: "library",
    src: root,
    projects: [project],
  };
  const directives = await projectDirectives(library);
  expect(directives).toEqual(
    new Set(["openscad", "excalidraw", "blockflow-player", "blockflow"]),
  );
  await fs.unlink(path.join(root, "book", "index.md"));
  await fs.unlink(path.join(root, "book", "sketch.md.json"));
  await fetchAssets(library, new AssetManager(options));
  expect(download).toHaveBeenCalledOnce();
  await expect(
    fs.stat(path.join(root, ".hyperbook", "out")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("prefetches a shared runtime when any book in a library needs it locally", async () => {
  await fs.writeFile(path.join(root, "book", "index.md"), player);
  const otherRoot = path.join(root, "other");
  await fs.mkdir(path.join(otherRoot, "book"), { recursive: true });
  await fs.writeFile(path.join(otherRoot, "book", "index.md"), player);
  await fs.writeFile(
    path.join(otherRoot, "hyperbook.json"),
    JSON.stringify({ name: "CDN", elements: { blockflow: { cdn: true } } }),
  );
  const library: Hyperproject = {
    name: "Library",
    type: "library",
    src: root,
    projects: [project, { name: "CDN", type: "book", src: otherRoot }],
  };
  await fetchAssets(library, new AssetManager(options));
  expect(download).toHaveBeenCalledOnce();
});
