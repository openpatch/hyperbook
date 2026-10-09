import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { create } from "tar";
import { AssetManager, AssetManifest, AssetOptions } from "../helpers/assets";

let root: string;
let archive: Buffer;
let manifest: AssetManifest;
let options: AssetOptions;
let download: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-assets-"));
  const input = path.join(root, "input");
  await fs.mkdir(path.join(input, "directive-blockflow", "chunks"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(input, "directive-blockflow", "player.html"),
    "<html>player</html>",
  );
  await fs.writeFile(
    path.join(input, "directive-blockflow", "chunks", "runtime.js"),
    "runtime",
  );
  const file = path.join(root, "bundle.tar.gz");
  await create(
    { file, cwd: input, gzip: true, portable: true, noMtime: true },
    ["directive-blockflow"],
  );
  archive = await fs.readFile(file);
  manifest = {
    format: 1,
    version: "test",
    bundles: {
      blockflow: {
        url: "https://example.com/blockflow.tar.gz",
        sha256: createHash("sha256").update(archive).digest("hex"),
        bytes: archive.length,
        files: {
          "directive-blockflow/player.html": Buffer.byteLength(
            "<html>player</html>",
          ),
          "directive-blockflow/chunks/runtime.js": 7,
        },
      },
    },
  };
  options = {
    cacheDir: path.join(root, "cache"),
    assetsPath: path.join(root, "core"),
    manifestPath: path.join(root, "manifest.json"),
    bundlesPath: path.join(root, "bundles"),
  };
  await fs.writeFile(options.manifestPath!, JSON.stringify(manifest));
  download = vi.fn(async () => new Response(new Uint8Array(archive)));
  vi.stubGlobal("fetch", download);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

describe("on-demand assets", () => {
  it("copies only integration files in CDN mode without downloading or accessing the cache", async () => {
    const source = path.join(options.assetsPath!, "directive-pyide");
    await fs.mkdir(path.join(source, "pyodide"), { recursive: true });
    await fs.writeFile(path.join(source, "client.js"), "client");
    await fs.writeFile(path.join(source, "style.css"), "style");
    await fs.writeFile(path.join(source, "pyodide", "pyodide.js"), "runtime");
    const output = path.join(root, "out");
    await new AssetManager({ ...options, offline: true }).copyDirective(
      "pyide",
      output,
      true,
    );
    expect(await fs.readdir(path.join(output, "directive-pyide"))).toEqual([
      "client.js",
      "style.css",
    ]);
    await expect(fs.stat(options.cacheDir!)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads a runtime when only the small CLI integration files are installed", async () => {
    const source = path.join(options.assetsPath!, "directive-blockflow");
    await fs.mkdir(source, { recursive: true });
    const resolved = await new AssetManager(options).ensure("blockflow");
    expect(resolved).not.toBe(source);
    expect(download).toHaveBeenCalledOnce();
  });
  it("uses locally built archives offline before their release exists, with the same checksum validation", async () => {
    const bundles = path.join(options.bundlesPath!, manifest.version);
    await fs.mkdir(bundles, { recursive: true });
    const local = path.join(bundles, "blockflow.tar.gz");
    await fs.writeFile(local, archive);
    const source = await new AssetManager({ ...options, offline: true }).ensure(
      "blockflow",
    );
    expect(await fs.readFile(path.join(source!, "player.html"), "utf8")).toBe(
      "<html>player</html>",
    );
    expect(download).not.toHaveBeenCalled();
    await fs.writeFile(local, "corrupt");
    await expect(
      new AssetManager({
        ...options,
        offline: true,
        cacheDir: path.join(root, "fresh-cache"),
      }).ensure("blockflow"),
    ).rejects.toThrow("SHA-256 verification");
    expect(download).not.toHaveBeenCalled();
  });
  it("uses bundled assets and accepts directives without assets without contacting a server", async () => {
    await fs.mkdir(path.join(options.assetsPath!, "directive-alert"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(options.assetsPath!, "directive-alert", "style.css"),
      "alert",
    );
    const manager = new AssetManager(options);
    await manager.copyDirective("alert", path.join(root, "out"));
    expect(
      await fs.readFile(
        path.join(root, "out", "directive-alert", "style.css"),
        "utf8",
      ),
    ).toBe("alert");
    expect(await manager.ensure("step")).toBeUndefined();
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads on first use and reuses the complete cache in a new offline process", async () => {
    const manager = new AssetManager(options);
    const output = path.join(root, "out");
    await fs.mkdir(path.join(output, "directive-blockflow"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(output, "directive-blockflow", "generated.json"),
      "generated",
    );
    await manager.copyDirective("blockflow", output);
    expect(
      await fs.readFile(
        path.join(output, "directive-blockflow", "chunks", "runtime.js"),
        "utf8",
      ),
    ).toBe("runtime");
    expect(
      await fs.readFile(
        path.join(output, "directive-blockflow", "generated.json"),
        "utf8",
      ),
    ).toBe("generated");
    expect(download).toHaveBeenCalledOnce();
    const cached = await new AssetManager({ ...options, offline: true }).ensure(
      "blockflow",
    );
    expect(await fs.readFile(path.join(cached!, "player.html"), "utf8")).toBe(
      "<html>player</html>",
    );
    expect(download).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent requests within a build", async () => {
    const manager = new AssetManager(options);
    const paths = await Promise.all([
      manager.ensure("blockflow"),
      manager.ensure("blockflow"),
      manager.ensure("blockflow"),
    ]);
    expect(new Set(paths).size).toBe(1);
    expect(download).toHaveBeenCalledOnce();
  });

  it("publishes complete generations when independent builds share the cache", async () => {
    const paths = await Promise.all([
      new AssetManager(options).ensure("blockflow"),
      new AssetManager(options).ensure("blockflow"),
    ]);
    for (const source of paths)
      expect(await fs.readFile(path.join(source!, "player.html"), "utf8")).toBe(
        "<html>player</html>",
      );
    await new AssetManager({ ...options, offline: true }).ensure("blockflow");
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("reports missing offline assets without downloading or creating the cache", async () => {
    await expect(
      new AssetManager({ ...options, offline: true }).ensure("blockflow"),
    ).rejects.toThrow('Run "hyperbook assets fetch"');
    expect(download).not.toHaveBeenCalled();
    await expect(fs.stat(options.cacheDir!)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects corrupt downloads, cleans staging files and permits retry", async () => {
    download.mockImplementationOnce(
      async () => new Response(new Uint8Array(Buffer.alloc(archive.length))),
    );
    const manager = new AssetManager(options);
    await expect(manager.ensure("blockflow")).rejects.toThrow("SHA-256");
    const cache = path.join(
      options.cacheDir!,
      manifest.bundles.blockflow.sha256,
    );
    expect(await fs.readdir(cache)).toEqual([]);
    expect(await manager.ensure("blockflow")).toBeDefined();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("handles HTTP failures and interrupted responses without trusting partial downloads", async () => {
    download.mockImplementationOnce(
      async () => new Response("missing", { status: 404 }),
    );
    const manager = new AssetManager(options);
    await expect(manager.ensure("blockflow")).rejects.toThrow("HTTP 404");
    download.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(archive.subarray(0, 20)));
              controller.error(new Error("connection interrupted"));
            },
          }),
        ),
    );
    await expect(manager.ensure("blockflow")).rejects.toThrow(
      "connection interrupted",
    );
    expect(
      await fs.readdir(
        path.join(options.cacheDir!, manifest.bundles.blockflow.sha256),
      ),
    ).toEqual([]);
    await expect(manager.ensure("blockflow")).resolves.toBeDefined();
  });

  it("detects incomplete caches offline and repairs them online", async () => {
    const source = await new AssetManager(options).ensure("blockflow");
    await fs.unlink(path.join(source!, "chunks", "runtime.js"));
    await expect(
      new AssetManager({ ...options, offline: true }).ensure("blockflow"),
    ).rejects.toThrow("missing");
    const repaired = await new AssetManager(options).ensure("blockflow");
    expect(
      await fs.readFile(path.join(repaired!, "chunks", "runtime.js"), "utf8"),
    ).toBe("runtime");
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("rejects archives containing links even with a valid download checksum", async () => {
    const input = path.join(root, "input");
    await fs.symlink(
      "../../outside",
      path.join(input, "directive-blockflow", "link"),
    );
    const file = path.join(root, "linked.tar.gz");
    await create({ file, cwd: input, gzip: true }, ["directive-blockflow"]);
    archive = await fs.readFile(file);
    manifest.bundles.blockflow.bytes = archive.length;
    manifest.bundles.blockflow.sha256 = createHash("sha256")
      .update(archive)
      .digest("hex");
    await fs.writeFile(options.manifestPath!, JSON.stringify(manifest));
    await expect(new AssetManager(options).ensure("blockflow")).rejects.toThrow(
      "Unexpected asset archive entry",
    );
  });

  it("rejects unsafe paths in the manifest before downloading", async () => {
    manifest.bundles.blockflow.files["directive-blockflow/../../outside"] = 7;
    await fs.writeFile(options.manifestPath!, JSON.stringify(manifest));
    await expect(new AssetManager(options).ensure("blockflow")).rejects.toThrow(
      "Invalid asset manifest entry",
    );
    expect(download).not.toHaveBeenCalled();
  });
});
