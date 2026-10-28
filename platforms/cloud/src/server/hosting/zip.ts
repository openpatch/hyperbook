import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

/*
 * Unpacks an uploaded book. Every entry name is checked before anything is
 * written, sizes come from the zip's central directory and are enforced while
 * inflating (yauzl's validateEntrySizes), and the platform writes plain files
 * itself, so a zip can neither escape the target directory nor create links.
 */

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export type ZipLimits = { maxBytes: number; maxEntries: number };

export type ExtractResult = {
  /** Directory inside the zip that held the book ("" for the zip's root). */
  root: string;
  files: number;
  bytes: number;
  /** Entries left out on purpose (symlinks); shown to the teacher. */
  skipped: string[];
};

const BOOK_MARKERS = new Set(["hyperbook.json", "hyperlibrary.json"]);

/** Clutter that never belongs in a book's repository. */
function isClutter(segments: string[]): boolean {
  return segments.some(
    (s, i) =>
      s === "__MACOSX" ||
      s === "node_modules" ||
      s === ".hyperbook" ||
      (i === segments.length - 1 && (s === ".DS_Store" || s === "Thumbs.db")),
  );
}

/** The entry's path segments, or a reason to refuse the whole zip. */
export function entrySegments(name: string): string[] {
  if (name.includes("\0")) throw new ZipError(`Invalid file name in zip: ${JSON.stringify(name)}`);
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new ZipError(`The zip contains an absolute path: ${name}`);
  }
  const segments = normalized.split("/").filter((s, i, all) => s !== "" || i < all.length - 1);
  for (const s of segments) {
    if (s === "" || s === "." || s === "..") {
      throw new ZipError(`The zip contains an invalid path: ${name}`);
    }
    if (s.toLowerCase() === ".git") {
      throw new ZipError(`The zip contains a .git folder (${name}); upload the book's files without it`);
    }
    if (Buffer.byteLength(s) > 255) {
      throw new ZipError(`A file name in the zip is too long: ${name}`);
    }
  }
  return segments;
}

type Item = { entry: yauzl.Entry; segments: string[]; directory: boolean };

function isSymlink(entry: yauzl.Entry): boolean {
  // Unix mode bits live in the upper half of the external attributes.
  return ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000;
}

async function readEntries(zip: yauzl.ZipFile, limits: ZipLimits): Promise<yauzl.Entry[]> {
  if (zip.entryCount > limits.maxEntries) {
    throw new ZipError(`The zip has more than ${limits.maxEntries} files`);
  }
  const entries: yauzl.Entry[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.on("entry", (entry: yauzl.Entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on("end", resolve);
    zip.on("error", reject);
    zip.readEntry();
  });
  return entries;
}

/** The shallowest directory holding a hyperbook.json or hyperlibrary.json. */
function findRoot(items: Item[]): string[] {
  let best: string[][] = [];
  for (const { segments, directory } of items) {
    if (directory || !BOOK_MARKERS.has(segments[segments.length - 1]!)) continue;
    const dir = segments.slice(0, -1);
    if (best.length === 0 || dir.length < best[0]!.length) best = [dir];
    else if (dir.length === best[0]!.length) best.push(dir);
  }
  if (best.length === 0) {
    throw new ZipError("The zip contains no hyperbook.json or hyperlibrary.json");
  }
  const distinct = new Set(best.map((d) => d.join("/")));
  if (distinct.size > 1) {
    throw new ZipError(
      `The zip contains several books (${[...distinct].map((d) => d || "/").join(", ")}); upload one at a time`,
    );
  }
  return best[0]!;
}

function within(segments: string[], root: string[]): boolean {
  return segments.length > root.length && root.every((s, i) => segments[i] === s);
}

export async function extractBook(
  zipFile: string,
  dest: string,
  limits: ZipLimits,
): Promise<ExtractResult> {
  let zip: yauzl.ZipFile;
  try {
    zip = await yauzl.openPromise(zipFile, {
      lazyEntries: true,
      autoClose: false,
      validateEntrySizes: true,
      strictFileNames: false,
    });
  } catch (error) {
    throw new ZipError(`This is not a valid zip file (${(error as Error).message})`);
  }

  try {
    let entries: yauzl.Entry[];
    try {
      entries = await readEntries(zip, limits);
    } catch (error) {
      if (error instanceof ZipError) throw error;
      throw new ZipError(`The zip file is damaged (${(error as Error).message})`);
    }

    const items: Item[] = [];
    for (const entry of entries) {
      const segments = entrySegments(entry.fileName);
      if (segments.length === 0 || isClutter(segments)) continue;
      items.push({ entry, segments, directory: entry.fileName.endsWith("/") });
    }

    const root = findRoot(items);
    const skipped: string[] = [];
    const files: Item[] = [];
    let bytes = 0;
    for (const item of items) {
      if (item.directory || !within(item.segments, root)) continue;
      if (isSymlink(item.entry)) {
        skipped.push(item.segments.slice(root.length).join("/"));
        continue;
      }
      if (item.entry.isEncrypted()) {
        throw new ZipError("The zip is password-protected");
      }
      bytes += item.entry.uncompressedSize;
      if (bytes > limits.maxBytes) {
        throw new ZipError(
          `The unpacked book is larger than ${Math.floor(limits.maxBytes / 1024 / 1024)} MB`,
        );
      }
      files.push(item);
    }

    const seen = new Set<string>();
    for (const { entry, segments } of files) {
      const relative = segments.slice(root.length);
      const key = relative.join("/");
      // Two entries with one name: the zip is ambiguous, refuse rather than
      // pick one silently.
      if (seen.has(key)) throw new ZipError(`The zip contains ${key} twice`);
      seen.add(key);
      const target = path.join(dest, ...relative);
      try {
        await mkdir(path.dirname(target), { recursive: true });
        const stream = await zip.openReadStreamPromise(entry);
        // "wx": never follow or replace anything already at the target.
        await pipeline(stream, createWriteStream(target, { flags: "wx" }));
      } catch (error) {
        throw new ZipError(`Could not unpack ${key} (${(error as Error).message})`);
      }
    }

    return { root: root.join("/"), files: files.length, bytes, skipped };
  } finally {
    zip.close();
  }
}
