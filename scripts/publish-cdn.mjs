import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Kept in each publishing repository so releases do not depend on another repo.
const run = promisify(execFile);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cacheControl = "public, max-age=31536000, immutable";
const contentTypes = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".zip": "application/zip",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".txt": "text/plain",
};

export function releasePrefix(element, version) {
  if (
    !["onlineide", "sqlide", "openscad"].includes(element) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version) ||
    version === "latest"
  ) {
    throw new Error(
      "Expected a supported element and an immutable release version",
    );
  }
  return `${element}/${version}`;
}

export async function runtimeManifest(directory) {
  const files = {};
  async function visit(folder, prefix = "") {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(`Runtime contains a symlink: ${relative}`);
      if (entry.isDirectory())
        await visit(path.join(folder, entry.name), `${relative}/`);
      else if (entry.isFile() && !/\.(map|html)$/i.test(relative)) {
        if (relative === "manifest.json")
          throw new Error("manifest.json is reserved for publication metadata");
        const bytes = await fs.readFile(path.join(folder, entry.name));
        files[relative] = {
          sha256: hash(bytes),
          bytes: bytes.length,
          contentType:
            contentTypes[path.extname(relative).toLowerCase()] ||
            "application/octet-stream",
        };
      }
    }
  }
  await visit(directory);
  if (!Object.keys(files).length)
    throw new Error("No runtime files to publish");
  return { schema: 1, files };
}

export function wranglerStore(bucket = "cdn", runImpl = run) {
  return {
    async get(key) {
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cdn-read-"));
      const file = path.join(temporary, "object");
      try {
        await runImpl("wrangler", [
          "r2",
          "object",
          "get",
          `${bucket}/${key}`,
          "--remote",
          "--file",
          file,
        ]);
        return await fs.readFile(file);
      } catch (error) {
        if (
          /The specified key does not exist/.test(
            `${error.stdout}\n${error.stderr}`,
          )
        )
          return null;
        throw error;
      } finally {
        await fs.rm(temporary, { recursive: true, force: true });
      }
    },
    async put(key, file, contentType) {
      await runImpl("wrangler", [
        "r2",
        "object",
        "put",
        `${bucket}/${key}`,
        "--remote",
        "--file",
        file,
        "--content-type",
        contentType,
        "--cache-control",
        cacheControl,
      ]);
    },
  };
}

export async function publishCdn({
  directory,
  element,
  version,
  store = wranglerStore(),
}) {
  const prefix = releasePrefix(element, version);
  const manifest = await runtimeManifest(directory);
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  const manifestKey = `${prefix}/manifest.json`;
  const previous = await store.get(manifestKey);
  if (previous) {
    if (!bytes.equals(previous))
      throw new Error(`Published runtime is immutable: ${prefix}`);
    console.log(`${prefix} is already published and matches the release`);
    return manifest;
  }
  // A failed upload can be resumed. Existing objects must match before reuse.
  // The manifest is written last, after all payload objects have been uploaded.
  const files = Object.entries(manifest.files);
  let next = 0;
  const uploads = await Promise.allSettled(
    Array.from({ length: Math.min(4, files.length) }, async () => {
      while (next < files.length) {
        const [relative, metadata] = files[next++];
        const key = `${prefix}/${relative}`;
        const previous = await store.get(key);
        if (previous) {
          if (hash(previous) !== metadata.sha256)
            throw new Error(`Existing runtime object differs: ${key}`);
        } else {
          const file = path.join(directory, relative);
          if (hash(await fs.readFile(file)) !== metadata.sha256)
            throw new Error(`Runtime changed during upload: ${relative}`);
          await store.put(key, file, metadata.contentType);
        }
      }
    }),
  );
  const failed = uploads.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cdn-manifest-"));
  try {
    const file = path.join(temporary, "manifest.json");
    await fs.writeFile(file, bytes);
    await store.put(manifestKey, file, "application/json");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  console.log(
    `Published ${files.length} files at https://cdn.openpatch.org/${prefix}/`,
  );
  return manifest;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [element, version, directory] = process.argv.slice(2);
  if (!directory)
    throw new Error(
      "Usage: node scripts/publish-cdn.mjs <element> <version> <directory>",
    );
  await publishCdn({ directory, element, version });
}
