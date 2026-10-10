import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeManifest } from "./publish-cdn.mjs";
import { verifyCdn } from "./verify-cdn.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdown = path.join(root, "packages/markdown");
const readJson = async (file) =>
  JSON.parse(await fs.readFile(path.join(markdown, file), "utf8"));
const ideReleases = await readJson("ide-releases.json");
const { wasmBuild } = await readJson("openscad-config.json");
const assets = await readJson("runtime-assets.json");
const openscadFiles = new Set([
  ...wasmBuild.files,
  ...assets
    .filter((asset) => asset.target.startsWith("directive-openscad/"))
    .map((asset) => asset.target.slice("directive-openscad/".length)),
]);

// Gate package publication on the exact runtimes built into the CLI bundles.
// The small Hyperbook integration scripts remain local, outside CDN manifests.
const results = await Promise.allSettled(
  Object.entries({ ...ideReleases, openscad: wasmBuild.cdnVersion }).map(
    async ([element, version]) => {
      const directory = path.join(
        markdown,
        "dist/assets",
        `directive-${element}`,
      );
      const manifest = await runtimeManifest(directory);
      manifest.files = Object.fromEntries(
        Object.entries(manifest.files).filter(([file]) =>
          element === "openscad"
            ? openscadFiles.has(file)
            : file.startsWith("include/"),
        ),
      );
      await verifyCdn({ element, version, manifest });
    },
  ),
);
const failed = results.filter((result) => result.status === "rejected");
if (failed.length)
  throw new AggregateError(
    failed.map((result) => result.reason),
    "Default CDN runtimes must be published before Hyperbook packages",
  );
