import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureRuntimeAssetArchive } from "../packages/markdown/runtime-assets.mjs";
import { wranglerStore } from "./publish-cdn.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdown = path.join(root, "packages/markdown");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function readRuntimeAssets() {
  return JSON.parse(
    await fs.readFile(path.join(markdown, "runtime-assets.json"), "utf8"),
  );
}

// Archives are released per element and version, so the mirror URL is fully
// determined by the target, the pinned version and the upstream file name.
function archiveRelease(asset) {
  const element = asset.target.replace(/^directive-/, "").split("/")[0];
  const name = path.basename(new URL(asset.upstreamUrl).pathname);
  const prefix = `runtime-archives/${element}/${asset.version}/`;
  return { element, name, prefix, key: `${prefix}${name}` };
}

export async function publishRuntimeArchives({
  assets,
  store = wranglerStore(),
  cacheDir = path.join(markdown, ".cache/runtime-assets"),
} = {}) {
  if (!assets) assets = await readRuntimeAssets();
  const mirrored = assets.filter((asset) => asset.upstreamUrl);
  if (!mirrored.length) throw new Error("No runtime asset archives to publish");
  const releases = new Map();
  for (const asset of mirrored) {
    const release = archiveRelease(asset);
    if (asset.url !== `https://cdn.openpatch.org/${release.key}`)
      throw new Error(
        `Mirror URL does not match the release key: ${asset.url}`,
      );
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0)
      throw new Error(
        `Mirrored asset must pin its archive size: ${asset.upstreamUrl}`,
      );
    const group = releases.get(release.element) || [];
    group.push({ ...release, asset });
    releases.set(release.element, group);
  }
  for (const [element, group] of releases) {
    const versions = [
      ...new Set(group.map((release) => release.asset.version)),
    ];
    if (versions.length > 1)
      throw new Error(
        `Inconsistent archive versions for ${element}: ${versions.join(", ")}`,
      );
  }
  for (const [, group] of releases) {
    const prefix = group[0].prefix;
    // The pinned sizes make the marker computable without a single download,
    // so a published release is a true no-op even on a cold cache.
    const files = {};
    for (const { name, asset } of group)
      files[name] = {
        sha256: asset.sha256,
        bytes: asset.bytes,
        contentType: "application/zip",
      };
    const marker = Buffer.from(
      JSON.stringify({ schema: 1, files }, null, 2) + "\n",
    );
    const markerKey = `${prefix}manifest.json`;
    const previous = await store.get(markerKey);
    if (previous) {
      if (!marker.equals(previous))
        throw new Error(`Published runtime archives are immutable: ${prefix}`);
      console.log(`${prefix} is already published and matches the release`);
      continue;
    }
    // A failed upload can be resumed. Existing objects must match before reuse.
    for (const { name, asset, key } of group) {
      const existing = await store.get(key);
      if (existing) {
        if (hash(existing) !== asset.sha256)
          throw new Error(`Existing runtime archive differs: ${key}`);
        continue;
      }
      // Verified archives come from the warm cache when possible; a fresh
      // machine downloads them from upstream once.
      const archive = await ensureRuntimeAssetArchive(
        { ...asset, url: asset.upstreamUrl },
        cacheDir,
      );
      if ((await fs.stat(archive)).size !== asset.bytes)
        throw new Error(`Archive size does not match its pinned size: ${name}`);
      await store.put(key, archive, "application/zip");
      console.log(`Published https://cdn.openpatch.org/${key}`);
    }
    const temporary = await fs.mkdtemp(
      path.join(os.tmpdir(), "runtime-archive-manifest-"),
    );
    try {
      const file = path.join(temporary, "manifest.json");
      await fs.writeFile(file, marker);
      await store.put(markerKey, file, "application/json");
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
    console.log(
      `Published ${group.length} archives at https://cdn.openpatch.org/${prefix}`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await publishRuntimeArchives();
}
