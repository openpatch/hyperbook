import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { isNotNull } from "drizzle-orm";
import { extract } from "tar";
import type { Db } from "../db/client";
import { builds } from "../db/schema";
import type { Config } from "../config";

/*
 * Element runtimes (Pyodide, Excalidraw, ...) are the bulk of a built book:
 * the archives the CLI ships are about 500 MB. Instead of unpacking them into
 * every build of every book, the instance extracts them once per Hyperbook
 * version into dataDir/shared-runtimes/<version>/ and serves them to readers
 * on every book host under /_hyperbook/assets/<version>/, with a year of
 * immutable caching: the version is part of the address. Books whose
 * hyperbook.json does not ask for a custom CDN (elements.*.cdn) or a local
 * copy (cdn: false) load them from there; the build only copies the small
 * integration scripts (see HYPERBOOK_SHARED_ASSETS_BASE in the CLI).
 */

/** The platform prefix of the address the runtimes are served under. */
export const SHARED_ASSETS_PREFIX = "_hyperbook/assets";

/** Versions name directories, so they stay boring. */
export const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Extracted runtimes of one Hyperbook version. */
export function sharedRuntimesDir(config: Config, version: string): string {
  return path.join(config.dataDir, "shared-runtimes", version);
}

/** Where the CLI downloads and unpacks runtimes for builds, kept between builds. */
export function assetCacheDir(config: Config): string {
  return path.join(config.dataDir, "asset-cache");
}

/** The base the build resolves element runtime files against. */
export function sharedAssetsBase(version: string): string {
  return `/${SHARED_ASSETS_PREFIX}/${version}/`;
}

export type RuntimeManifest = {
  version: string;
  elements: string[];
  /** Content hash of every element's bundle, for pruning the download cache. */
  shas: string[];
};

/** The runtimes the configured CLI can extract, read once per process. */
export function cliRuntimeManifest(config: Config): RuntimeManifest | null {
  return manifestFor(path.dirname(config.build.cli));
}

const manifests = new Map<string, RuntimeManifest | null>();

function manifestFor(cliDir: string): RuntimeManifest | null {
  if (!manifests.has(cliDir)) {
    let manifest: RuntimeManifest | null = null;
    try {
      const parsed = JSON.parse(
        readFileSync(path.join(cliDir, "asset-manifest.json"), "utf8"),
      );
      const bundles = parsed?.bundles;
      const elements =
        bundles && typeof bundles === "object"
          ? Object.keys(bundles).filter(
              (element) =>
                /^[a-z0-9-]+$/.test(element) &&
                /^[a-f0-9]{64}$/.test(String(bundles[element]?.sha256 ?? "")),
            )
          : [];
      if (
        typeof parsed?.version === "string" &&
        SAFE_VERSION.test(parsed.version) &&
        elements.length > 0
      ) {
        manifest = {
          version: parsed.version,
          elements,
          shas: elements.map((element) => bundles[element].sha256 as string),
        };
      }
    } catch {
      manifest = null;
    }
    manifests.set(cliDir, manifest);
  }
  return manifests.get(cliDir) ?? null;
}

/**
 * The base to hand a build, or null when the instance cannot serve the
 * runtimes itself: without a manifest, with nothing set to "local", or
 * with a local element's archive missing, the build falls back to copying
 * runtimes into the book, as it always did.
 *
 * `cdn` lists the elements whose runtimes the admin chose to load from their
 * public CDN instead of this instance (see instance settings).
 */
export function sharedAssetsBaseFor(
  config: Config,
  cdn: readonly string[] = [],
): string | null {
  const local = localElements(config, cdn);
  if (!local) return null;
  return sharedAssetsBase(cliRuntimeManifest(config)!.version);
}

/**
 * The elements the instance serves itself, with every archive in place, or
 * null when there are none.
 */
export function localElements(
  config: Config,
  cdn: readonly string[] = [],
): string[] | null {
  const manifest = cliRuntimeManifest(config);
  if (!manifest) return null;
  const archives = path.join(
    path.dirname(config.build.cli),
    "..",
    ".cache",
    "asset-bundles",
    manifest.version,
  );
  const local = manifest.elements.filter((element) => !cdn.includes(element));
  if (
    local.length === 0 ||
    !local.every((element) =>
      existsSync(path.join(archives, `${element}.tar.gz`)),
    )
  )
    return null;
  return local;
}

const extracting = new Map<string, Promise<string | null>>();

/**
 * The extracted runtime of one element: the directory the shared address
 * serves from, or null when there is none (and no archive to make one from).
 * Extracts on first use, so only elements books actually use cost time and
 * disk; concurrent callers share one extraction. Later calls re-validate the
 * extracted runtime's marker, which costs a read, so an interrupted or failed
 * extraction is completed or retried by the next request.
 */
export function ensureRuntime(
  config: Config,
  version: string,
  element: string,
): Promise<string | null> {
  const destination = path.join(
    sharedRuntimesDir(config, version),
    `directive-${element}`,
  );
  let run = extracting.get(destination);
  if (!run) {
    run = extractRuntime(config, version, element, destination).then(
      (dir) => {
        extracting.delete(destination);
        return dir;
      },
      (error) => {
        extracting.delete(destination);
        console.error(
          `Could not extract the ${element} runtime: ${(error as Error).message}`,
        );
        return null;
      },
    );
    extracting.set(destination, run);
  }
  return run;
}

async function extractRuntime(
  config: Config,
  version: string,
  element: string,
  destination: string,
): Promise<string | null> {
  if (await extracted(destination, version)) return destination;
  // Only the configured CLI's version has archives to extract from; older
  // versions keep serving whatever was extracted while they were current.
  const manifest = cliRuntimeManifest(config);
  if (
    !manifest ||
    manifest.version !== version ||
    !manifest.elements.includes(element)
  )
    return null;
  const archive = path.join(
    path.dirname(config.build.cli),
    "..",
    ".cache",
    "asset-bundles",
    version,
    `${element}.tar.gz`,
  );
  if (!existsSync(archive)) return null;

  const versionDir = path.dirname(destination);
  await mkdir(versionDir, { recursive: true });
  const staging = await mkdtemp(path.join(versionDir, ".extracting-"));
  try {
    const prefix = `directive-${element}`;
    await extract({
      file: archive,
      cwd: staging,
      strict: true,
      // Archives are packed by the CLI's own build; the filter keeps a
      // corrupted one from writing anywhere but its element's directory.
      filter(entryPath) {
        const name = entryPath.replace(/\/$/, "");
        return name === prefix || name.startsWith(`${prefix}/`);
      },
    });
    await writeFile(path.join(staging, prefix, ".complete"), version);
    // Replaces an incomplete leftover, if an extraction was interrupted.
    await rm(destination, { recursive: true, force: true });
    await rename(path.join(staging, prefix), destination);
    await rm(staging, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

async function extracted(
  destination: string,
  version: string,
): Promise<boolean> {
  try {
    return (
      (await readFile(path.join(destination, ".complete"), "utf8")) === version
    );
  } catch {
    return false;
  }
}

/**
 * Removes shared runtimes that no build uses anymore: the current version
 * stays, and so does every version a kept build record was built with, so
 * published books keep working until the upgrade rebuilt them. Records note
 * the CLI's package version; the CLI's build stamps it into its manifest, so
 * the two agree for built CLIs.
 */
export function pruneSharedRuntimes(db: Db, config: Config): void {
  const current = cliRuntimeManifest(config)?.version;
  if (!current) return;
  const referenced = new Set(
    db
      .select({ version: builds.hyperbookVersion })
      .from(builds)
      .where(isNotNull(builds.hyperbookVersion))
      .all()
      .map((row) => row.version),
  );
  const root = path.join(config.dataDir, "shared-runtimes");
  for (const entry of existsSync(root) ? readdirSync(root) : []) {
    if (entry === current || referenced.has(entry) || !SAFE_VERSION.test(entry))
      continue;
    rmSync(path.join(root, entry), { recursive: true, force: true });
  }
}

/** Removes download cache entries of runtimes the configured CLI cannot need. */
export async function pruneAssetCache(config: Config): Promise<void> {
  const manifest = cliRuntimeManifest(config);
  if (!manifest) return;
  for (const entry of await readdir(assetCacheDir(config)).catch(() => [])) {
    if (!/^[a-f0-9]{64}$/.test(entry) || manifest.shas.includes(entry))
      continue;
    await rm(path.join(assetCacheDir(config), entry), {
      recursive: true,
      force: true,
    });
  }
}
