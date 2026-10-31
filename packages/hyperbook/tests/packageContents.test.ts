import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DownloadableElement,
  elementCoreFiles,
  elementRuntimeFiles,
} from "@hyperbook/types";
import { expect, it } from "vitest";

const dist = path.join(__dirname, "..", "dist");

it("starts the bundled CLI with its bundled Markdown renderer", () => {
  const help = execFileSync(
    process.execPath,
    [path.join(dist, "index.js"), "--help"],
    { encoding: "utf8" },
  );
  expect(help).toContain("Usage:");
  expect(help).toContain("assets");
});

it("ships the SVG rasterizer of favicon generation beside the CLI", async () => {
  // WebAssembly is no native addon, so it runs inside the build sandbox of
  // Hyperbook Cloud; the sandbox reads the CLI's directory, and dist is all
  // the npm package ships (helpers/generate-favicons loads it from there).
  const wasm = path.join(dist, "resvg.wasm");
  expect((await fs.stat(wasm)).isFile()).toBe(true);
  expect((await fs.stat(wasm)).size).toBeGreaterThan(100_000);
});

it("ships integration files and a download manifest without large runtimes", async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(dist, "asset-manifest.json"), "utf8"),
  );
  for (const element of Object.keys(
    elementCoreFiles,
  ) as DownloadableElement[]) {
    expect(manifest.bundles).toHaveProperty(element);
    const directory = path.join(dist, "assets", `directive-${element}`);
    for (const file of elementCoreFiles[element])
      expect((await fs.stat(path.join(directory, file))).isFile()).toBe(true);
    for (const file of elementRuntimeFiles[element])
      await expect(fs.stat(path.join(directory, file))).rejects.toMatchObject({
        code: "ENOENT",
      });
  }
});
