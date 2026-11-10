import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import type { Config } from "../config";
import { typstDir, typstLibrary } from "./typst";
import { entrySegments, isSymlink } from "./zip";

/*
 * The instance's shared Typst packages (DATA_DIR/typst/library), laid out as
 * Typst expects: <namespace>/<name>/<version>/. Every book's Typst documents
 * can import them (hosting/typst.ts), so admins add them here as zips. A
 * version is never replaced, only added or removed: books name the version
 * they import, and keep building the same way until they move on.
 */

export class PackageError extends Error {}

export type LibraryPackage = { namespace: string; name: string; version: string; bytes: number };

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VERSION = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;

/** `preview` is Typst Universe's: a package there would shadow the real one. */
export function validNamespace(namespace: string): boolean {
  return NAME.test(namespace) && namespace !== "preview";
}

/** The `name` and `version` of a package's typst.toml ([package] table). */
export function packageManifest(toml: string): { name: string; version: string } | null {
  let table = "";
  const found: Record<string, string> = {};
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      table = header[1]!.trim();
      continue;
    }
    if (table !== "package") continue;
    const pair = /^(name|version)\s*=\s*"([^"]*)"$/.exec(line);
    if (pair) found[pair[1]!] = pair[2]!;
  }
  if (!found.name || !found.version) return null;
  return { name: found.name, version: found.version };
}

async function dirBytes(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirBytes(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
}

/** Every package version in the library. */
export async function listPackages(config: Config): Promise<LibraryPackage[]> {
  const root = typstLibrary(config);
  const packages: LibraryPackage[] = [];
  const dirs = async (dir: string) =>
    (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  for (const namespace of await dirs(root)) {
    for (const name of await dirs(path.join(root, namespace))) {
      for (const version of await dirs(path.join(root, namespace, name))) {
        packages.push({ namespace, name, version, bytes: await dirBytes(path.join(root, namespace, name, version)) });
      }
    }
  }
  return packages;
}

/**
 * Adds the package in `zipFile` under `namespace`. The zip holds one
 * typst.toml (at its root or in one folder); its name and version decide
 * where the package goes. Entries are checked like a book's upload: no
 * absolute paths, no `..`, no links, sizes enforced while unpacking.
 */
export async function addPackage(
  config: Config,
  zipFile: string,
  namespace: string,
  limits: { maxBytes: number; maxEntries: number },
): Promise<LibraryPackage> {
  if (!validNamespace(namespace)) throw new PackageError("typstLibrary.invalidNamespace");
  let zip: yauzl.ZipFile;
  try {
    zip = await yauzl.openPromise(zipFile, { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: false });
  } catch {
    throw new PackageError("typstLibrary.notZip");
  }
  const staging = path.join(typstDir(config), "staging");
  await mkdir(staging, { recursive: true });
  const unpacked = await mkdtemp(path.join(staging, "package-"));
  try {
    if (zip.entryCount > limits.maxEntries) throw new PackageError("typstLibrary.tooLarge");
    const entries: yauzl.Entry[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        zip.on("entry", (entry: yauzl.Entry) => {
          entries.push(entry);
          zip.readEntry();
        });
        zip.on("end", () => resolve());
        zip.on("error", reject);
        zip.readEntry();
      });
    } catch (error) {
      // yauzl refuses some paths itself while reading the directory.
      throw new PackageError(/path/i.test((error as Error).message) ? "typstLibrary.invalidPath" : "typstLibrary.notZip");
    }
    let segments: { entry: yauzl.Entry; segments: string[] }[];
    try {
      segments = entries
        .filter((entry) => !entry.fileName.endsWith("/"))
        .map((entry) => ({ entry, segments: entrySegments(entry.fileName) }))
        .filter(({ segments }) => !segments.some((s) => s === "__MACOSX" || s === ".DS_Store"));
    } catch {
      throw new PackageError("typstLibrary.invalidPath");
    }
    const tomls = segments.filter(({ segments }) => segments.at(-1) === "typst.toml" && segments.length <= 2);
    if (tomls.length !== 1) throw new PackageError("typstLibrary.noManifest");
    const root = tomls[0]!.segments.slice(0, -1);
    let bytes = 0;
    for (const { entry, segments: parts } of segments) {
      if (!root.every((s, i) => parts[i] === s)) continue;
      if (isSymlink(entry)) throw new PackageError("typstLibrary.link");
      if (entry.isEncrypted()) throw new PackageError("typstLibrary.notZip");
      bytes += entry.uncompressedSize;
      if (bytes > limits.maxBytes) throw new PackageError("typstLibrary.tooLarge");
      const target = path.join(unpacked, ...parts.slice(root.length));
      await mkdir(path.dirname(target), { recursive: true });
      const stream = await zip.openReadStreamPromise(entry);
      await pipeline(stream, createWriteStream(target, { flags: "wx" }));
    }
    const manifest = packageManifest(await readFile(path.join(unpacked, "typst.toml"), "utf8"));
    if (!manifest || !NAME.test(manifest.name) || !VERSION.test(manifest.version)) {
      throw new PackageError("typstLibrary.badManifest");
    }
    const target = path.join(typstLibrary(config), namespace, manifest.name, manifest.version);
    if (existsSync(target)) throw new PackageError("typstLibrary.exists");
    await mkdir(path.dirname(target), { recursive: true });
    await rename(unpacked, target);
    return { namespace, name: manifest.name, version: manifest.version, bytes };
  } finally {
    zip.close();
    await rm(unpacked, { recursive: true, force: true });
  }
}

/** Removes one package version; false if there was none. */
export async function removePackage(config: Config, pkg: { namespace: string; name: string; version: string }): Promise<boolean> {
  if (!validNamespace(pkg.namespace) || !NAME.test(pkg.name) || !VERSION.test(pkg.version)) return false;
  const dir = path.join(typstLibrary(config), pkg.namespace, pkg.name, pkg.version);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  // Empty folders of the name and namespace go too.
  for (const parent of [path.dirname(dir), path.dirname(path.dirname(dir))]) {
    if ((await readdir(parent).catch(() => ["x"])).length === 0) await rm(parent, { recursive: true, force: true });
  }
  return true;
}
