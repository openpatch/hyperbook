import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

/** Formats that are compressed already; deflating them again only costs time. */
const STORED = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".mp3", ".mp4", ".webm", ".ogg",
  ".zip", ".h5p", ".woff", ".woff2", ".pdf", ".gz",
]);

async function* files(root: string, dir = ""): AsyncGenerator<string> {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* files(root, rel);
    else if (entry.isFile()) yield rel;
  }
}

/** The files below `root` as a zip, streamed: a build can be hundreds of MB. */
export function zipDirectory(root: string): Readable {
  const out = new Readable({ read() {} });
  const zip = new Zip((error, chunk, final) => {
    if (error) return out.destroy(error);
    out.push(chunk);
    if (final) out.push(null);
  });
  void (async () => {
    for await (const name of files(root)) {
      const entry = STORED.has(path.extname(name).toLowerCase())
        ? new ZipPassThrough(name)
        : new ZipDeflate(name, { level: 6 });
      zip.add(entry);
      for await (const chunk of createReadStream(path.join(root, name))) {
        entry.push(chunk as Uint8Array);
      }
      entry.push(new Uint8Array(0), true);
    }
    zip.end();
  })().catch((error) => out.destroy(error));
  return out;
}
