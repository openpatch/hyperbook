import fs from "fs";
import path from "path";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";

/*
 * Typst packages for `:::typst` blocks. The browser compiles those blocks
 * (typst.ts), so it has to load the packages they import: the build packs
 * each one it finds — in the book's `typst.packagePath`, or in the shared
 * folder of HYPERBOOK_TYPST_PACKAGE_PATH — into the site as
 * `/__hyperbook_typst/<namespace>/<name>-<version>.tar.gz`, and the block
 * tells its client where they are. Imports inside a package are followed.
 * `@preview` packages that neither folder holds are left to Typst Universe.
 *
 * Whatever a block imports is published with the book: its sources reach
 * every reader.
 */

export type TypstPackageSpec = { namespace: string; name: string; version: string };

/** A package a page's blocks use, and the folder it is packed from. */
export interface TypstPackage extends TypstPackageSpec {
  /** Absolute path of `<namespace>/<name>/<version>`. */
  dir: string;
  /** Where the archive is served, relative to the site's root. */
  href: string;
}

const IMPORT = /@([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*):(\d+\.\d+\.\d+)/g;

export const specKey = (spec: TypstPackageSpec) =>
  `@${spec.namespace}/${spec.name}:${spec.version}`;

/** Every `@namespace/name:version` in `text`. */
export function findTypstImports(text: string): TypstPackageSpec[] {
  const found = new Map<string, TypstPackageSpec>();
  for (const match of text.matchAll(IMPORT)) {
    const spec = { namespace: match[1]!, name: match[2]!, version: match[3]! };
    found.set(specKey(spec), spec);
  }
  return [...found.values()];
}

/** Where a package is served from, relative to the site's root. */
export const typstPackageHref = (spec: TypstPackageSpec) =>
  `/__hyperbook_typst/${spec.namespace}/${spec.name}-${spec.version}.tar.gz`;

/** The folders packages are looked up in: the book's own first. */
export function typstPackageFolders(ctx: Pick<HyperbookContext, "root" | "config">): string[] {
  const folders: string[] = [];
  const own = ctx.config.typst?.packagePath;
  if (own) {
    const resolved = path.resolve(ctx.root, own);
    if (resolved === ctx.root || resolved.startsWith(ctx.root + path.sep)) folders.push(resolved);
  }
  const shared = process.env.HYPERBOOK_TYPST_PACKAGE_PATH;
  if (shared) folders.push(path.resolve(shared));
  return folders;
}

function typFiles(dir: string, depth = 0): string[] {
  if (depth > 8) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...typFiles(full, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(".typ")) files.push(full);
  }
  return files;
}

/**
 * The packages `specs` name that the book or the shared folder holds, and
 * the ones those import, each once.
 */
export function resolveTypstPackages(
  ctx: Pick<HyperbookContext, "root" | "config">,
  specs: TypstPackageSpec[],
): TypstPackage[] {
  const folders = typstPackageFolders(ctx);
  const found = new Map<string, TypstPackage>();
  const queue = [...specs];
  while (queue.length > 0 && found.size < 200) {
    const spec = queue.shift()!;
    const key = specKey(spec);
    if (found.has(key)) continue;
    const dir = folders
      .map((folder) => path.join(folder, spec.namespace, spec.name, spec.version))
      .find((candidate) => fs.existsSync(path.join(candidate, "typst.toml")));
    if (!dir) continue;
    found.set(key, { ...spec, dir, href: typstPackageHref(spec) });
    for (const file of typFiles(dir)) {
      try {
        queue.push(...findTypstImports(fs.readFileSync(file, "utf8")));
      } catch {
        // Unreadable: the compiler will say so.
      }
    }
  }
  return [...found.values()];
}

/** Records the packages a page's blocks use, for the build to pack. */
export function registerTypstPackages(file: VFile, packages: TypstPackage[]) {
  const all = (file.data.typstPackages ||= []) as TypstPackage[];
  for (const pkg of packages) {
    if (!all.some((p) => p.href === pkg.href)) all.push(pkg);
  }
}
