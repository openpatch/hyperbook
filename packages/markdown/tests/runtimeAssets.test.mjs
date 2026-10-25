import fs from "fs/promises";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { create } from "tar";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installRuntimeAssets } from "../runtime-assets.mjs";

let root, cache, output;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-runtime-assets-"));
  cache = path.join(root, "cache");
  output = path.join(root, "assets");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

it("checks runtime downloads and reuses cached files without network access", async () => {
  const bytes = Buffer.from("wasm");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = {
    url: "https://example.com/runtime",
    sha256,
    format: "file",
    target: "directive-typst/compiler.wasm",
  };
  const fetch = vi.fn(async () => new Response(bytes));
  vi.stubGlobal("fetch", fetch);
  await installRuntimeAssets([asset], output, cache);
  expect(await fs.readFile(path.join(output, asset.target), "utf8")).toBe(
    "wasm",
  );
  await installRuntimeAssets([asset], output, cache);
  expect(fetch).toHaveBeenCalledTimes(1);
  await fs.writeFile(path.join(cache, sha256), "corrupt");
  await installRuntimeAssets([asset], output, cache);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("retries a transient download failure and succeeds on the next attempt", async () => {
  const bytes = Buffer.from("wasm");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = {
    url: "https://example.com/runtime",
    sha256,
    format: "file",
    target: "runtime.js",
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("unavailable", { status: 500 }))
    .mockResolvedValueOnce(new Response(bytes));
  vi.stubGlobal("fetch", fetch);
  // Only setTimeout is faked so the real event loop keeps serving I/O.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const installation = installRuntimeAssets([asset], output, cache);
    while (fetch.mock.calls.length < 2) {
      await vi.advanceTimersByTimeAsync(5_000);
      await new Promise((resolve) => setImmediate(resolve));
    }
    await installation;
  } finally {
    vi.useRealTimers();
  }
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await fs.readFile(path.join(output, asset.target), "utf8")).toBe(
    "wasm",
  );
});

it("rejects a corrupt runtime without leaving a completed cache entry", async () => {
  const fetch = vi.fn(async () => new Response("corrupt"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    installRuntimeAssets(
      [
        {
          url: "https://example.com/runtime",
          sha256: "0".repeat(64),
          format: "file",
          target: "runtime.js",
        },
      ],
      output,
      cache,
    ),
  ).rejects.toThrow("checksum mismatch");
  // A completed download with a pinned checksum is never retried.
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await fs.readdir(cache)).toEqual([]);
});

it("extracts only the chosen font subtree and excludes unnecessary test assets", async () => {
  await fs.mkdir(path.join(root, "bundle", "fonts"), { recursive: true });
  await fs.writeFile(path.join(root, "bundle", "fonts", "font.otf"), "font");
  await fs.writeFile(
    path.join(root, "bundle", "fonts", "font-tests.tar"),
    "tests",
  );
  await fs.writeFile(path.join(root, "bundle", "other"), "other");
  const archive = path.join(root, "bundle.tar.gz");
  await create({ file: archive, cwd: root, gzip: true }, ["bundle"]);
  const bytes = await fs.readFile(archive);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
  await installRuntimeAssets(
    [
      {
        url: "https://example.com/fonts",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        format: "tar.gz",
        target: "fonts",
        prefix: "bundle/fonts/",
        strip: 2,
        exclude: ["-tests.tar"],
      },
    ],
    output,
    cache,
  );
  expect(await fs.readdir(path.join(output, "fonts"))).toEqual(["font.otf"]);
});
