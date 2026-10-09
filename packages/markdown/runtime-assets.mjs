import fs from "fs/promises";
import path from "path";
import { createReadStream, createWriteStream } from "fs";
import { createHash } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createRequire } from "module";
import { Extract } from "unzipper";

const require = createRequire(import.meta.url);
const unbzip2 = require("unbzip2-stream");
const { extract } = require("tar");

async function checksum(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function installRuntimeAssets(
  assets,
  output = "dist/assets",
  cache = ".cache/runtime-assets",
) {
  await fs.mkdir(cache, { recursive: true });
  for (const asset of assets) {
    const archive = path.join(cache, asset.sha256);
    if (
      !(await fs.stat(archive).catch(() => null)) ||
      (await checksum(archive)) !== asset.sha256
    ) {
      const response = await fetch(asset.url, {
        signal: AbortSignal.timeout(600_000),
      });
      if (!response.ok || !response.body)
        throw new Error(
          `Could not download ${asset.url}: HTTP ${response.status}`,
        );
      const staging = await fs.mkdtemp(path.join(cache, ".download-"));
      const downloaded = path.join(staging, "asset");
      try {
        await pipeline(
          Readable.fromWeb(response.body),
          createWriteStream(downloaded),
        );
        if ((await checksum(downloaded)) !== asset.sha256)
          throw new Error(`Runtime asset checksum mismatch: ${asset.url}`);
        await fs.rename(downloaded, archive);
      } finally {
        await fs.rm(staging, { recursive: true, force: true });
      }
    }
    const target = path.join(output, asset.target);
    if (asset.format === "file") {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(archive, target);
      continue;
    }
    await fs.mkdir(target, { recursive: true });
    if (asset.format === "zip") {
      await pipeline(createReadStream(archive), Extract({ path: target }));
      continue;
    }
    const unpack = extract({
      cwd: target,
      strip: asset.strip || 0,
      strict: true,
      filter(name, entry) {
        return (
          (entry.type === "File" || entry.type === "Directory") &&
          (!asset.prefix || name.startsWith(asset.prefix)) &&
          !(asset.exclude || []).some((suffix) => name.endsWith(suffix))
        );
      },
    });
    if (asset.format === "tar.bz2")
      await pipeline(createReadStream(archive), unbzip2(), unpack);
    else await pipeline(createReadStream(archive), unpack);
  }
}
