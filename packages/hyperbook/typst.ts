import { spawn } from "child_process";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import type { TypstJob, TypstPackage } from "@hyperbook/markdown";
import { create as createTar } from "tar";
import type { HyperbookJson } from "@hyperbook/types";
import { assetCacheDir, excludeMatcherFor } from "@hyperbook/fs";
import {
  resolveTypstVersion,
  sha256File,
  typstBinary,
} from "./helpers/typst-binary";

/*
 * Builds the Typst documents pages ask for (`::pdf[…]{src="x.typ"}`) into
 * PDFs, after the pages, like the archives.
 *
 * - `--root` is the book's root, so `#import "/templates/…"` resolves the
 *   same everywhere and nothing outside the book is read.
 * - A compile cache in `.hyperbook/typst-cache/` keeps an unchanged
 *   document from being compiled again: Typst lists every file it read
 *   (`--deps`), and the entry stores their hashes. Fonts are not in that
 *   list, so the font folder is hashed as a whole.
 * - With HYPERBOOK_TYPST=manifest nothing is compiled: the jobs are written
 *   to `.hyperbook/typst-jobs.json` for a host to run (Hyperbook Cloud, whose
 *   sandboxed build may not start processes).
 */

export type TypstSettings = {
  version: string;
  /** The book's own package folder, relative to the root. */
  packagePath?: string;
  /** The book's font folder, relative to the root. */
  fontPath?: string;
};

/** What a host needs to run the jobs itself (HYPERBOOK_TYPST=manifest). */
export type TypstManifestFile = {
  format: 1;
  version: string;
  packagePath: string | null;
  fontPath: string | null;
  /** The build output, relative to the root. */
  outDir: string;
  jobs: TypstJob[];
};

export class TypstBuildError extends Error {}

const CACHE_FORMAT = 1;

/** The book's Typst settings, or an error for settings that leave the book. */
export function typstSettings(
  root: string,
  config: Pick<HyperbookJson, "typst">,
  warn: (message: string) => void = () => {},
): TypstSettings {
  const typst = config.typst ?? {};
  const inBook = (name: "packagePath" | "fontPath") => {
    const value = typst[name];
    if (value === undefined || value === "") return undefined;
    const resolved = path.resolve(root, value);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new TypstBuildError(`typst.${name} must be a folder inside the book: ${value}`);
    }
    return path.relative(root, resolved).split(path.sep).join("/");
  };
  return {
    version: resolveTypstVersion(typst.version, undefined, warn),
    packagePath: inBook("packagePath"),
    fontPath: inBook("fontPath"),
  };
}

/** One job per output; the first page naming it wins, as all are equal. */
export function uniqueJobs(jobs: TypstJob[]): TypstJob[] {
  const byOut = new Map<string, TypstJob>();
  for (const job of jobs) if (!byOut.has(job.out)) byOut.set(job.out, job);
  return [...byOut.values()];
}

/**
 * Fails when a job would write over a file the build copies (a
 * `blatt.pdf` next to `blatt.typ`).
 */
export function assertNoCollisions(jobs: TypstJob[], copied: Map<string, string>) {
  for (const job of jobs) {
    const there = copied.get(job.out);
    if (there) {
      throw new TypstBuildError(
        `${job.src} would be built to ${job.out}, but ${there} is published at that address already. Rename one of them.`,
      );
    }
  }
}

async function exists(file: string) {
  return !!(await fs.stat(file).catch(() => null));
}

/**
 * The `--package-path` of a build: the book's own package folder, and the
 * shared packages of HYPERBOOK_TYPST_PACKAGE_PATH under it. Typst takes one
 * folder, so with both a merged view is made of links, one per package
 * version, the book's copy winning.
 */
export async function packagePathFor(
  root: string,
  settings: Pick<TypstSettings, "packagePath">,
  shared: string | undefined,
  merged: string,
): Promise<string | undefined> {
  const own = settings.packagePath ? path.join(root, settings.packagePath) : undefined;
  if (!shared) return own;
  await fs.rm(merged, { recursive: true, force: true });
  await fs.mkdir(merged, { recursive: true });
  for (const source of [path.resolve(shared), own]) {
    if (!source || !(await exists(source))) continue;
    for (const namespace of await fs.readdir(source, { withFileTypes: true })) {
      if (!namespace.isDirectory()) continue;
      for (const name of await fs.readdir(path.join(source, namespace.name), { withFileTypes: true })) {
        if (!name.isDirectory()) continue;
        const versions = await fs.readdir(path.join(source, namespace.name, name.name), { withFileTypes: true });
        for (const version of versions) {
          if (!version.isDirectory()) continue;
          const from = path.join(source, namespace.name, name.name, version.name);
          const to = path.join(merged, namespace.name, name.name, version.name);
          await fs.mkdir(path.dirname(to), { recursive: true });
          await fs.rm(to, { recursive: true, force: true });
          try {
            await fs.symlink(from, to, "junction");
          } catch {
            // No links (some Windows setups): a copy does the same.
            await fs.cp(from, to, { recursive: true });
          }
        }
      }
    }
  }
  return merged;
}

/** Names and hashes of every file in the font folder: fonts are not in --deps. */
async function fontsHash(root: string, fontPath: string | undefined) {
  if (!fontPath) return "";
  const dir = path.join(root, fontPath);
  const lines: string[] = [];
  const walk = async (current: string) => {
    for (const entry of (await fs.readdir(current, { withFileTypes: true }).catch(() => [])).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) lines.push(`${path.relative(dir, full)}:${await sha256File(full)}`);
    }
  };
  await walk(dir);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

type CacheEntry = {
  format: number;
  compiler: string;
  src: string;
  inputs: Record<string, string>;
  packagePath: string | null;
  fontPath: string | null;
  fonts: string;
  /** Every file Typst read, as it listed them, with its hash. */
  deps: Record<string, string>;
  pdf: string;
};

const cacheKey = (job: TypstJob) =>
  createHash("sha256")
    .update(JSON.stringify([job.src, job.inputs]))
    .digest("hex")
    .slice(0, 24);

async function depsHashes(root: string, deps: string[]) {
  const hashes: Record<string, string> = {};
  for (const dep of deps) {
    const file = path.resolve(root, dep);
    if (!(await exists(file))) return null;
    hashes[dep] = await sha256File(file);
  }
  return hashes;
}

/** The cached PDF of `job` when nothing it was made from has changed. */
async function cached(
  root: string,
  cacheDir: string,
  job: TypstJob,
  expected: Omit<CacheEntry, "deps" | "pdf">,
): Promise<string | null> {
  const key = cacheKey(job);
  const entry = JSON.parse(
    await fs.readFile(path.join(cacheDir, `${key}.json`), "utf8").catch(() => "null"),
  ) as CacheEntry | null;
  if (!entry) return null;
  for (const field of Object.keys(expected) as (keyof typeof expected)[]) {
    if (JSON.stringify(entry[field]) !== JSON.stringify(expected[field])) return null;
  }
  const now = await depsHashes(root, Object.keys(entry.deps));
  if (!now || JSON.stringify(now) !== JSON.stringify(entry.deps)) return null;
  const pdf = path.join(cacheDir, `${key}.pdf`);
  if (!(await exists(pdf)) || (await sha256File(pdf)) !== entry.pdf) return null;
  return pdf;
}

export type CompileResult = { ok: true } | { ok: false; diagnostics: string };

type Compiler = {
  binary: string;
  /** What identifies the compiler in the cache. */
  identity: string;
};

/** Runs one compile; the PDF is written to `out` only when it succeeds. */
async function compile(
  compiler: Compiler,
  root: string,
  job: TypstJob,
  options: {
    out: string;
    deps: string;
    packagePath?: string;
    packageCachePath: string;
    fontPath?: string;
    creationTimestamp?: string;
  },
): Promise<CompileResult> {
  const partial = `${options.out}.partial-${process.pid}`;
  const args = [
    "compile",
    // The partial file's name ends in no known extension.
    "--format",
    "pdf",
    "--root",
    root,
    "--ignore-system-fonts",
    "--diagnostic-format",
    "short",
    "--deps",
    options.deps,
    "--deps-format",
    "json",
    "--package-cache-path",
    options.packageCachePath,
    ...(options.packagePath ? ["--package-path", options.packagePath] : []),
    ...(options.fontPath ? ["--font-path", path.join(root, options.fontPath)] : []),
    ...(options.creationTimestamp ? ["--creation-timestamp", options.creationTimestamp] : []),
    ...Object.entries(job.inputs).flatMap(([key, value]) => ["--input", `${key}=${value}`]),
    job.src,
    partial,
  ];
  const { code, output } = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(compiler.binary, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => (output += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (output += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
  if (code !== 0) {
    await fs.rm(partial, { force: true });
    return { ok: false, diagnostics: output.trim() || `typst exited with ${code}` };
  }
  await fs.rename(partial, options.out);
  return { ok: true };
}

export type RunTypstOptions = {
  root: string;
  rootOut: string;
  config: Pick<HyperbookJson, "typst">;
  jobs: TypstJob[];
  /** Files the build copies, by address, with where they come from. */
  copied: Map<string, string>;
  prefix?: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Builds every job into the output. Throws a TypstBuildError with Typst's
 * diagnostics when a document does not compile.
 */
export async function runTypst({
  root,
  rootOut,
  config,
  jobs: all,
  copied,
  prefix = "Typst",
  env = process.env,
}: RunTypstOptions): Promise<void> {
  const jobs = uniqueJobs(all);
  if (jobs.length === 0) return;
  assertNoCollisions(jobs, copied);
  const warn = (message: string) =>
    console.warn(`${chalk.yellow(`[${prefix}]`)} ${message}`);
  const settings = typstSettings(root, config, warn);

  if (env.HYPERBOOK_TYPST === "manifest") {
    const manifest: TypstManifestFile = {
      format: 1,
      version: settings.version,
      packagePath: settings.packagePath ?? null,
      fontPath: settings.fontPath ?? null,
      outDir: path.relative(root, rootOut).split(path.sep).join("/"),
      jobs,
    };
    await fs.mkdir(path.join(root, ".hyperbook"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".hyperbook", "typst-jobs.json"),
      JSON.stringify(manifest, null, 2),
    );
    console.log(
      `${chalk.blue(`[${prefix}]`)} ${jobs.length} Typst document(s) left to the host to build.`,
    );
    return;
  }

  const binary = await typstBinary(settings.version, env);
  const compiler: Compiler = {
    binary,
    identity: env.HYPERBOOK_TYPST_BINARY
      ? `custom:${binary}:${(await fs.stat(binary).catch(() => null))?.size ?? 0}`
      : settings.version,
  };
  const hyperbookDir = path.join(root, ".hyperbook");
  const cacheDir = path.join(hyperbookDir, "typst-cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const packagePath = await packagePathFor(
    root,
    settings,
    env.HYPERBOOK_TYPST_PACKAGE_PATH,
    path.join(hyperbookDir, "typst-packages"),
  );
  const packageCachePath = path.join(assetCacheDir(), "typst-packages");
  const fonts = await fontsHash(root, settings.fontPath);
  const creationTimestamp = env.SOURCE_DATE_EPOCH || undefined;

  let built = 0;
  for (const job of jobs) {
    const out = path.join(rootOut, job.out);
    await fs.mkdir(path.dirname(out), { recursive: true });
    const expected = {
      format: CACHE_FORMAT,
      compiler: compiler.identity,
      src: job.src,
      inputs: job.inputs,
      packagePath: settings.packagePath ?? null,
      fontPath: settings.fontPath ?? null,
      fonts,
    };
    const hit = await cached(root, cacheDir, job, expected);
    if (hit) {
      await fs.copyFile(hit, out);
      continue;
    }
    const key = cacheKey(job);
    const deps = path.join(cacheDir, `${key}.deps.json`);
    const result = await compile(compiler, root, job, {
      out,
      deps,
      packagePath,
      packageCachePath,
      fontPath: settings.fontPath,
      creationTimestamp,
    });
    if (!result.ok) {
      await fs.rm(deps, { force: true });
      throw new TypstBuildError(
        `Typst could not build ${job.src}${Object.keys(job.inputs).length ? ` (inputs ${JSON.stringify(job.inputs)})` : ""}:\n${result.diagnostics}`,
      );
    }
    built++;
    const listed = JSON.parse(await fs.readFile(deps, "utf8")) as { inputs: string[] };
    await fs.rm(deps, { force: true });
    const hashes = await depsHashes(root, listed.inputs);
    if (!hashes) continue;
    // Written under temporary names and renamed: a build killed half-way
    // leaves no entry that points at a missing or partial PDF.
    const tmp = path.join(cacheDir, `.${key}.${process.pid}`);
    await fs.copyFile(out, `${tmp}.pdf`);
    await fs.rename(`${tmp}.pdf`, path.join(cacheDir, `${key}.pdf`));
    const entry: CacheEntry = { ...expected, deps: hashes, pdf: await sha256File(out) };
    await fs.writeFile(`${tmp}.json`, JSON.stringify(entry));
    await fs.rename(`${tmp}.json`, path.join(cacheDir, `${key}.json`));
  }
  console.log(
    `${chalk.blue(`[${prefix}]`)} Typst: ${built} document(s) built, ${jobs.length - built} unchanged.`,
  );
}

/** The files of `deps` lists for a job, for the dev server's watcher. */
export async function typstDependencies(root: string, job: TypstJob): Promise<string[]> {
  const entry = JSON.parse(
    await fs
      .readFile(path.join(root, ".hyperbook", "typst-cache", `${cacheKey(job)}.json`), "utf8")
      .catch(() => "null"),
  ) as CacheEntry | null;
  return entry ? Object.keys(entry.deps).map((dep) => path.resolve(root, dep)) : [];
}

const PACKAGE_HREF = /^\/__hyperbook_typst\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*-\d+\.\d+\.\d+\.tar\.gz$/;

/** The files of a package, relative to it; links and special files are left out. */
async function packageFiles(dir: string, prefix = ""): Promise<{ file: string; size: number; mtime: number }[]> {
  const files: { file: string; size: number; mtime: number }[] = [];
  for (const entry of await fs.readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await packageFiles(dir, relative)));
    else if (entry.isFile()) {
      const stat = await fs.stat(path.join(dir, relative));
      files.push({ file: relative, size: stat.size, mtime: stat.mtimeMs });
    }
  }
  return files;
}

/** What each archive was packed from, so an unchanged package is not packed again. */
const packed = new Map<string, string>();

/**
 * Packs the Typst packages a page's `:::typst` blocks import into the site
 * (see typstPackages.ts in @hyperbook/markdown). A package of the book
 * matched by its `exclude` globs is refused: the browser would need its
 * sources, and the book said they must not be published.
 */
export async function writeTypstPackages(
  root: string,
  rootOut: string,
  config: Pick<HyperbookJson, "exclude">,
  packages: TypstPackage[],
): Promise<void> {
  const excluded = excludeMatcherFor(config);
  for (const pkg of packages) {
    if (!PACKAGE_HREF.test(pkg.href)) continue;
    const files = await packageFiles(pkg.dir);
    const inBook = pkg.dir.startsWith(root + path.sep);
    if (inBook) {
      for (const { file } of files) {
        const relative = path.relative(root, path.join(pkg.dir, file)).split(path.sep).join("/");
        if (excluded(relative)) {
          throw new TypstBuildError(
            `The Typst package @${pkg.namespace}/${pkg.name}:${pkg.version} is imported by a :::typst block, which publishes it, but ${relative} is excluded by "exclude" in hyperbook.json.`,
          );
        }
      }
    }
    const out = path.join(rootOut, pkg.href);
    const signature = JSON.stringify([pkg.dir, files]);
    if (packed.get(out) === signature && (await exists(out))) continue;
    await fs.mkdir(path.dirname(out), { recursive: true });
    const partial = `${out}.partial-${process.pid}`;
    await createTar(
      { file: partial, cwd: pkg.dir, gzip: true, portable: true, noMtime: true, noDirRecurse: true },
      files.map((f) => f.file).sort(),
    );
    await fs.rename(partial, out);
    packed.set(out, signature);
  }
}
