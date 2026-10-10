import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installRuntimeAssets } from "../packages/markdown/runtime-assets.mjs";
import { releasePrefix } from "./publish-cdn.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Download the upstream WASM distribution, fonts and libraries directly. No
// published Markdown package or compiled Hyperbook integration is needed.
export async function prepareOpenscad(
  directory = path.join(root, ".cache/cdn-openscad/runtime"),
) {
  const { wasmBuild } = JSON.parse(
    await fs.readFile(
      path.join(root, "packages/markdown/openscad-config.json"),
      "utf8",
    ),
  );
  releasePrefix("openscad", wasmBuild.cdnVersion);
  const assets = JSON.parse(
    await fs.readFile(
      path.join(root, "packages/markdown/runtime-assets.json"),
      "utf8",
    ),
  );
  const extra = assets
    .filter((asset) => asset.target.startsWith(`${wasmBuild.target}/`))
    .map((asset) => ({
      ...asset,
      target: asset.target.slice(wasmBuild.target.length + 1),
    }));
  await fs.rm(directory, { recursive: true, force: true });
  await installRuntimeAssets(
    [
      {
        url: wasmBuild.url,
        sha256: wasmBuild.sha256,
        format: "zip",
        target: ".",
      },
      ...extra,
    ],
    directory,
    path.join(root, "packages/markdown/.cache/runtime-assets"),
  );
  for (const file of wasmBuild.files)
    await fs.access(path.join(directory, file));
  console.log(
    `Prepared OpenSCAD ${wasmBuild.cdnVersion} from checksum-verified upstream assets`,
  );
  return wasmBuild.cdnVersion;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await prepareOpenscad();
