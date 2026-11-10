import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readFileSync } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Config } from "../config";
import type { BuildLog } from "./runner";

/*
 * Typst documents of Hyperbook Cloud (`::pdf[…]{src="x.typ"}`).
 *
 * The build runs the CLI in Node's permission sandbox, which may not start
 * processes. So the CLI only writes the compile jobs to
 * `.hyperbook/typst-jobs.json` (HYPERBOOK_TYPST=manifest), and this module
 * runs Typst on them afterwards, outside the sandbox but with limits of its
 * own:
 *
 * - The manifest is untrusted input: every path is checked, the checkout may
 *   hold no links, the output goes only into the build's output.
 * - Typst runs with an empty environment, `--root` at the checkout and no
 *   system fonts, under `ulimit` (address space, file size, no core files),
 *   with a timeout per document inside the build's own deadline.
 * - Its binary is fetched by the server, checked against the CLI's list of
 *   supported versions, and kept where the sandboxed CLI can neither read nor
 *   write (DATA_DIR/typst).
 * - A cache per book keeps unchanged documents from being compiled again.
 */

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

export const typstDir = (config: Config) => path.join(config.dataDir, "typst");
const binDir = (config: Config) => path.join(typstDir(config), "bin");
/** Typst's `@preview` package cache, written only by Typst. */
export const typstPackageCache = (config: Config) => path.join(typstDir(config), "packages");
/** The instance's shared packages, written only by the admin page. */
export const typstLibrary = (config: Config) => path.join(typstDir(config), "library");
export const typstCacheDir = (config: Config, bookId: number) =>
  path.join(typstDir(config), "cache", String(bookId));

// ---------------------------------------------------------------------------
// Supported versions, from the CLI (typst-versions.json beside it)
// ---------------------------------------------------------------------------

type Release = {
  url: string;
  sha256: string;
  format: "tar.xz" | "zip";
  binary: string;
  binarySha256: string;
};

export type TypstVersions = {
  format: 1;
  default: string;
  versions: Record<string, Partial<Record<string, Release>>>;
};

const versionLists = new Map<string, TypstVersions | null>();

/** The Typst versions the instance's CLI supports; null when it lists none. */
export function typstVersions(config: Config): TypstVersions | null {
  const file = path.join(path.dirname(config.build.cli), "typst-versions.json");
  if (!versionLists.has(file)) {
    let list: TypstVersions | null = null;
    try {
      list = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      list = null;
    }
    versionLists.set(file, list);
  }
  return versionLists.get(file)!;
}

const linuxTarget = () =>
  process.arch === "arm64" ? "aarch64-unknown-linux-musl" : process.arch === "x64" ? "x86_64-unknown-linux-musl" : null;

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} exited with ${code}`))));
  });
}

export class TypstUnavailable extends Error {}

// ---------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------

export type TypstJob = { src: string; out: string; inputs: Record<string, string> };

export type TypstManifest = {
  version: string;
  packagePath: string | null;
  fontPath: string | null;
  jobs: TypstJob[];
};

const INPUT_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A relative posix path without `..`, `.` or empty segments. */
export const isPlainRelative = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 1024 &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !value.includes("\0") &&
  value.split("/").every((part) => part !== "" && part !== "." && part !== "..");

/**
 * Checks what the sandboxed CLI wrote. Returns the manifest, or why it is
 * refused. Paths are only checked for their form here; `checkTree` checks
 * the checkout itself.
 */
export function parseTypstManifest(
  text: string,
  options: { versions: string[]; maxJobs: number },
): { ok: true; manifest: TypstManifest } | { ok: false; error: string } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "The list of Typst documents is not valid JSON" };
  }
  if (!raw || typeof raw !== "object" || raw.format !== 1) return { ok: false, error: "The list of Typst documents has an unknown format" };
  if (!options.versions.includes(raw.version)) {
    return { ok: false, error: `Typst ${String(raw.version)} is not supported here. Supported versions: ${options.versions.join(", ")}` };
  }
  if (raw.outDir !== ".hyperbook/out") return { ok: false, error: "The Typst documents must be built into the build's output" };
  for (const field of ["packagePath", "fontPath"] as const) {
    if (raw[field] !== null && !isPlainRelative(raw[field])) {
      return { ok: false, error: `typst.${field} must be a folder inside the book` };
    }
  }
  if (!Array.isArray(raw.jobs)) return { ok: false, error: "The list of Typst documents has no jobs" };
  if (raw.jobs.length > options.maxJobs) {
    return { ok: false, error: `The book has ${raw.jobs.length} Typst documents; at most ${options.maxJobs} are built` };
  }
  const outs = new Set<string>();
  const jobs: TypstJob[] = [];
  for (const job of raw.jobs) {
    if (!job || !isPlainRelative(job.src) || !job.src.toLowerCase().endsWith(".typ")) {
      return { ok: false, error: `A Typst document has an invalid source: ${JSON.stringify(job?.src)}` };
    }
    if (typeof job.out !== "string" || !job.out.startsWith("/") || !isPlainRelative(job.out.slice(1)) || !job.out.endsWith(".pdf")) {
      return { ok: false, error: `A Typst document has an invalid address: ${JSON.stringify(job.out)}` };
    }
    if (outs.has(job.out)) return { ok: false, error: `Two Typst documents are built to ${job.out}` };
    outs.add(job.out);
    const inputs: Record<string, string> = {};
    if (!job.inputs || typeof job.inputs !== "object" || Array.isArray(job.inputs)) {
      return { ok: false, error: `${job.src} has invalid inputs` };
    }
    for (const [key, value] of Object.entries(job.inputs)) {
      if (!INPUT_KEY.test(key) || typeof value !== "string" || value.length > 1000) {
        return { ok: false, error: `${job.src} has an invalid input ${JSON.stringify(key)}` };
      }
      inputs[key] = value;
    }
    jobs.push({ src: job.src, out: job.out, inputs });
  }
  return { ok: true, manifest: { version: raw.version, packagePath: raw.packagePath, fontPath: raw.fontPath, jobs } };
}

/**
 * Refuses a checkout with links or special files in it. Git checks out no
 * links (core.symlinks=false), but the sandboxed build may have made some;
 * Typst, which runs outside the sandbox, would follow them out of the book.
 */
export async function checkTree(dir: string): Promise<string | null> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return `The book contains a link (${entry.name}), which is not allowed`;
    if (entry.isDirectory()) {
      const found = await checkTree(full);
      if (found) return found;
    } else if (!entry.isFile()) {
      return `The book contains a special file (${entry.name}), which is not allowed`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The compiler
// ---------------------------------------------------------------------------

/**
 * Starts Typst under limits: no core files, at most `memoryKb` of address
 * space and `fileBlocks` (512 bytes) per written file. The arguments go to
 * the script as positional parameters, never into its text.
 */
const LIMITS = [
  "ulimit -c 0",
  'ulimit -v "$1" 2>/dev/null || [ "$(uname)" != Linux ] || exit 70',
  'ulimit -f "$2" 2>/dev/null || [ "$(uname)" != Linux ] || exit 70',
  "shift 2",
  'exec "$@"',
].join("; ");

/** The Typst settings of a checkout's hyperbook.json, for preview compiles. */
export function typstSettingsOf(
  json: string,
  versions: TypstVersions | null,
): { version: string; packagePath: string | null; fontPath: string | null } | { error: string } {
  let typst: Record<string, unknown> = {};
  try {
    typst = (JSON.parse(json) as { typst?: Record<string, unknown> }).typst ?? {};
  } catch {
    typst = {};
  }
  const supported = Object.keys(versions?.versions ?? {});
  const version = typeof typst.version === "string" && typst.version ? typst.version : versions?.default;
  if (!version || !supported.includes(version)) {
    return { error: `Typst ${String(version)} is not supported here. Supported versions: ${supported.join(", ")}` };
  }
  const folder = (value: unknown) => {
    if (value === undefined || value === null || value === "") return null;
    const normalized = path.posix.normalize(String(value)).replace(/\/+$/, "");
    return isPlainRelative(normalized) ? normalized : undefined;
  };
  const packagePath = folder(typst.packagePath);
  const fontPath = folder(typst.fontPath);
  if (packagePath === undefined || fontPath === undefined) return { error: "typst.packagePath and typst.fontPath must be folders inside the book" };
  return { version, packagePath, fontPath };
}

export type CompileOutcome =
  | { ok: true; deps: string[] }
  | { ok: false; error: string; diagnostics: string };

export type CompileRequest = {
  binary: string;
  /** The checkout: Typst's root and working directory. */
  root: string;
  job: TypstJob;
  /** Where the PDF is written; only on success. */
  out: string;
  /** A folder of this compile's own, for its temporary files. */
  scratch: string;
  packagePath: string | null;
  packageCachePath: string;
  fontPath: string | null;
  creationTimestamp: number | null;
  timeoutMs: number;
  memoryMb: number;
  maxFileBytes: number;
  signal?: AbortSignal;
};

/** Runs one compile with the limits above. */
export async function compileTypst(request: CompileRequest): Promise<CompileOutcome> {
  const { job } = request;
  await mkdir(request.scratch, { recursive: true });
  const partial = path.join(request.scratch, "out.pdf");
  const deps = path.join(request.scratch, "deps.json");
  await rm(partial, { force: true });
  await rm(deps, { force: true });
  const args = [
    "compile",
    "--format",
    "pdf",
    "--root",
    request.root,
    "--ignore-system-fonts",
    "--diagnostic-format",
    "short",
    "--deps",
    deps,
    "--deps-format",
    "json",
    "--jobs",
    "2",
    "--package-cache-path",
    request.packageCachePath,
    ...(request.packagePath ? ["--package-path", request.packagePath] : []),
    ...(request.fontPath ? ["--font-path", path.join(request.root, request.fontPath)] : []),
    ...(request.creationTimestamp !== null ? ["--creation-timestamp", String(request.creationTimestamp)] : []),
    ...Object.entries(job.inputs).flatMap(([key, value]) => ["--input", `${key}=${value}`]),
    job.src,
    partial,
  ];
  const child = spawn(
    "/bin/sh",
    [
      "-c",
      LIMITS,
      "sh",
      String(request.memoryMb * 1024),
      String(Math.max(1, Math.floor(request.maxFileBytes / 512))),
      request.binary,
      ...args,
    ],
    {
      cwd: request.root,
      // Nothing of the server's environment.
      env: { HOME: request.scratch, PATH: "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const collect = (d: string) => {
    if (output.length < 64 * 1024) output += d;
  };
  child.stdout.setEncoding("utf8").on("data", collect);
  child.stderr.setEncoding("utf8").on("data", collect);

  let stopped: string | null = null;
  const stop = (reason: string) => {
    stopped ??= reason;
    child.kill("SIGKILL");
  };
  const timer = setTimeout(
    () => stop(`${job.src} took longer than ${Math.round(request.timeoutMs / 1000)} seconds and was stopped`),
    request.timeoutMs,
  );
  const onAbort = () => stop("The build was canceled");
  if (request.signal?.aborted) onAbort();
  request.signal?.addEventListener("abort", onAbort);
  const { code, signal } = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("error", (error) => {
      stopped ??= `Typst could not start: ${error.message}`;
      resolve({ code: null, signal: null });
    });
    child.on("close", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  request.signal?.removeEventListener("abort", onAbort);

  const diagnostics = output.trim();
  if ((stopped as string | null) || code !== 0) {
    await rm(partial, { force: true });
    // Set by the timer or the abort, which TypeScript does not follow.
    let error = stopped as string | null;
    if (!error) {
      if (signal === "SIGXFSZ") error = `${job.src} produced a file larger than this book may hold`;
      else if (signal === "SIGABRT" || /memory allocation of \d+ bytes failed/.test(diagnostics)) {
        error = `${job.src} needs more memory than allowed (${request.memoryMb} MB)`;
      } else if (code === 70) error = "The limits for Typst could not be set";
      else error = `Typst could not build ${job.src}`;
    }
    return { ok: false, error: error!, diagnostics };
  }
  let listed: string[] = [];
  try {
    listed = (JSON.parse(await readFile(deps, "utf8")) as { inputs: string[] }).inputs ?? [];
  } catch {
    listed = [];
  }
  await rename(partial, request.out);
  return { ok: true, deps: listed };
}

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

/** The folders a dependency may be in, each with a stable name. */
type Places = Record<"book" | "packages" | "cache", string>;

/** A dependency as Typst listed it, made independent of this build's folders. */
function portable(dep: string, cwd: string, places: Places): string | null {
  const absolute = path.resolve(cwd, dep);
  for (const [name, dir] of Object.entries(places)) {
    if (absolute.startsWith(dir + path.sep)) return `${name}:${path.relative(dir, absolute).split(path.sep).join("/")}`;
  }
  return null;
}

function located(dep: string, places: Places): string | null {
  const at = dep.indexOf(":");
  const dir = places[dep.slice(0, at) as keyof Places];
  if (!dir) return null;
  const rest = dep.slice(at + 1);
  if (!isPlainRelative(rest)) return null;
  return path.join(dir, rest);
}

type CacheEntry = {
  format: 1;
  key: string;
  deps: Record<string, string>;
  pdf: string;
};

const cacheKeyOf = (fields: unknown) => createHash("sha256").update(JSON.stringify(fields)).digest("hex");

async function hashDeps(deps: string[], places: Places): Promise<Record<string, string> | null> {
  const hashes: Record<string, string> = {};
  for (const dep of deps) {
    const file = located(dep, places);
    if (!file) return null;
    try {
      hashes[dep] = await sha256File(file);
    } catch {
      return null;
    }
  }
  return hashes;
}

async function fontsHash(root: string, fontPath: string | null): Promise<string> {
  if (!fontPath) return "";
  const dir = path.join(root, fontPath);
  const lines: string[] = [];
  const walk = async (current: string) => {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) lines.push(`${path.relative(dir, full)}:${await sha256File(full)}`);
    }
  };
  await walk(dir);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

export type BuildTypstRequest = {
  bookId: number;
  jobDir: string;
  srcDir: string;
  outDir: string;
  log: BuildLog;
  signal: AbortSignal;
  /** When the whole build must be done (ms since the epoch). */
  deadline: number;
  /** What the book's output may still grow by. */
  budgetBytes: number;
  /** The commit's time, so the same commit gives the same PDFs. */
  creationTimestamp: number | null;
};

export type BuildTypstOutcome = { ok: true; bytes: number; built: number; cached: number } | { ok: false; error: string };

/** One semaphore: at most `size` holders at once, the rest wait in order. */
class Slots {
  private free: number;
  private waiting: (() => void)[] = [];
  constructor(size: number) {
    this.free = size;
  }
  async use<T>(run: () => Promise<T>): Promise<T> {
    if (this.free > 0) this.free--;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await run();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.free++;
    }
  }
}

const services = new WeakMap<Config, TypstService>();

/** The instance's one service: its download and its preview queue are shared. */
export function typstServiceFor(config: Config): TypstService {
  let service = services.get(config);
  if (!service) {
    service = new TypstService(config);
    services.set(config, service);
  }
  return service;
}

export class TypstService {
  private installs = new Map<string, Promise<string>>();
  private checked = new Set<string>();
  readonly previewSlots: Slots;

  constructor(
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.previewSlots = new Slots(config.typst.previewConcurrency);
  }

  /** The supported versions; empty without a CLI that lists them. */
  versions(): string[] {
    return Object.keys(typstVersions(this.config)?.versions ?? {});
  }

  /**
   * The checked binary of `version`, fetched by the server on first use.
   * TYPST_BINARY replaces it (any version), e.g. on an instance without
   * network access.
   */
  binary(version: string, log?: BuildLog): Promise<string> {
    if (this.config.typst.binary) return Promise.resolve(this.config.typst.binary);
    let pending = this.installs.get(version);
    if (!pending) {
      pending = this.install(version, log);
      this.installs.set(version, pending);
      pending.catch(() => this.installs.delete(version));
    }
    return pending;
  }

  private async install(version: string, log?: BuildLog): Promise<string> {
    const target = linuxTarget();
    const release = target ? typstVersions(this.config)?.versions[version]?.[target] : undefined;
    if (!release) throw new TypstUnavailable(`Typst ${version} is not available for this server (${process.platform}/${process.arch})`);
    const dir = path.join(binDir(this.config), version);
    const binary = path.join(dir, "typst");
    if (existsSync(binary)) {
      // Checked again the first time this process uses it.
      if (this.checked.has(binary) || (await sha256File(binary)) === release.binarySha256) {
        this.checked.add(binary);
        return binary;
      }
    }
    await mkdir(dir, { recursive: true });
    const staging = await mkdtemp(path.join(dir, ".download-"));
    try {
      log?.note(`Downloading Typst ${version}`);
      let response: Response;
      try {
        response = await this.fetchImpl(release.url, { signal: AbortSignal.timeout(600_000) });
      } catch (error) {
        throw new TypstUnavailable(
          `Typst ${version} could not be downloaded (${(error as Error).message}). An admin can place the binary at ${binary} or set TYPST_BINARY.`,
        );
      }
      if (!response.ok || !response.body) {
        throw new TypstUnavailable(`Typst ${version} could not be downloaded (HTTP ${response.status})`);
      }
      const archive = path.join(staging, path.basename(release.url));
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(archive));
      if ((await sha256File(archive)) !== release.sha256) throw new TypstUnavailable(`The download of Typst ${version} does not match its checksum`);
      try {
        await run("tar", ["-xJf", archive, release.binary], staging, { PATH: "/usr/bin:/bin" });
      } catch (error) {
        throw new TypstUnavailable(`Typst ${version} could not be unpacked (${(error as Error).message}); the server needs tar with xz support`);
      }
      const unpacked = path.join(staging, release.binary);
      if ((await sha256File(unpacked)) !== release.binarySha256) throw new TypstUnavailable(`The Typst ${version} binary does not match its checksum`);
      await chmod(unpacked, 0o755);
      await rename(unpacked, binary);
      this.checked.add(binary);
      return binary;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  /**
   * The `--package-path` of a compile: a folder of links in `into` — the
   * instance's library first, then the book's own packages, which win.
   * Null when neither has any.
   */
  async packagePath(srcDir: string, own: string | null, into: string): Promise<string | null> {
    const sources = [typstLibrary(this.config), own ? path.join(srcDir, own) : null].filter(
      (dir): dir is string => !!dir && existsSync(dir),
    );
    if (sources.length === 0) return null;
    await rm(into, { recursive: true, force: true });
    await mkdir(into, { recursive: true });
    for (const source of sources) {
      for (const ns of await readdir(source, { withFileTypes: true })) {
        if (!ns.isDirectory()) continue;
        for (const name of await readdir(path.join(source, ns.name), { withFileTypes: true })) {
          if (!name.isDirectory()) continue;
          for (const version of await readdir(path.join(source, ns.name, name.name), { withFileTypes: true })) {
            if (!version.isDirectory()) continue;
            const to = path.join(into, ns.name, name.name, version.name);
            await mkdir(path.dirname(to), { recursive: true });
            await rm(to, { recursive: true, force: true });
            await symlink(path.join(source, ns.name, name.name, version.name), to);
          }
        }
      }
    }
    return into;
  }

  /**
   * Builds the Typst documents of a build whose CLI step wrote a manifest.
   * No manifest: nothing to do.
   */
  async build(request: BuildTypstRequest): Promise<BuildTypstOutcome> {
    const { srcDir, outDir, log } = request;
    const manifestFile = path.join(srcDir, ".hyperbook", "typst-jobs.json");
    if (!existsSync(manifestFile)) return { ok: true, bytes: 0, built: 0, cached: 0 };
    const parsed = parseTypstManifest(await readFile(manifestFile, "utf8"), {
      versions: this.versions(),
      maxJobs: this.config.typst.maxJobs,
    });
    if (!parsed.ok) return parsed;
    const { manifest } = parsed;
    if (manifest.jobs.length === 0) return { ok: true, bytes: 0, built: 0, cached: 0 };

    const problem = await checkTree(srcDir);
    if (problem) return { ok: false, error: problem };
    const realOut = await realpath(outDir);
    for (const job of manifest.jobs) {
      const source = await lstat(path.join(srcDir, job.src)).catch(() => null);
      if (!source?.isFile()) return { ok: false, error: `${job.src} is not in the book` };
    }

    let binary: string;
    try {
      binary = await this.binary(manifest.version, log);
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
    const packageCachePath = typstPackageCache(this.config);
    await mkdir(packageCachePath, { recursive: true });
    const packagePath = await this.packagePath(srcDir, manifest.packagePath, path.join(request.jobDir, "typst-packages"));
    const places: Places = {
      book: path.resolve(srcDir),
      packages: path.join(request.jobDir, "typst-packages"),
      cache: packageCachePath,
    };
    const fonts = await fontsHash(srcDir, manifest.fontPath);
    const cacheDir = typstCacheDir(this.config, request.bookId);
    await mkdir(cacheDir, { recursive: true });
    const used = new Set<string>();

    let bytes = 0;
    let built = 0;
    let cached = 0;
    for (const [index, job] of manifest.jobs.entries()) {
      const left = request.deadline - Date.now();
      if (left <= 0) return { ok: false, error: "The build took too long and was stopped" };
      if (request.signal.aborted) return { ok: false, error: "The build was canceled" };

      // The output's folder must be in the output, also through links the
      // sandboxed build might have made.
      const out = path.join(outDir, job.out.slice(1));
      await mkdir(path.dirname(out), { recursive: true });
      const parent = await realpath(path.dirname(out));
      if (parent !== realOut && !parent.startsWith(realOut + path.sep)) {
        return { ok: false, error: `${job.out} is outside the build's output` };
      }
      const existing = await lstat(out).catch(() => null);
      if (existing && !existing.isFile()) return { ok: false, error: `${job.out} is not a plain file` };

      const key = cacheKeyOf([
        manifest.version,
        this.config.typst.binary ? `custom:${this.config.typst.binary}` : "",
        job.src,
        job.inputs,
        manifest.packagePath,
        manifest.fontPath,
        fonts,
        request.creationTimestamp,
      ]);
      const name = createHash("sha256").update(JSON.stringify([job.src, job.inputs])).digest("hex").slice(0, 32);
      used.add(name);
      const hit = await this.lookup(cacheDir, name, key, places);
      if (hit) {
        await copyFile(hit, path.join(request.jobDir, "typst-hit.pdf"));
        await rename(path.join(request.jobDir, "typst-hit.pdf"), out);
        bytes += (await stat(out)).size;
        cached++;
        continue;
      }

      const outcome = await compileTypst({
        binary,
        root: srcDir,
        job,
        out: path.join(request.jobDir, `typst-${index}.pdf`),
        scratch: path.join(request.jobDir, "typst-scratch"),
        packagePath,
        packageCachePath,
        fontPath: manifest.fontPath,
        creationTimestamp: request.creationTimestamp,
        timeoutMs: Math.min(this.config.typst.timeoutMs, left),
        memoryMb: this.config.typst.memoryMb,
        maxFileBytes: Math.max(0, request.budgetBytes - bytes),
        signal: request.signal,
      });
      if (!outcome.ok) {
        if (outcome.diagnostics) log.write(`${outcome.diagnostics}\n`);
        return { ok: false, error: outcome.error };
      }
      const made = path.join(request.jobDir, `typst-${index}.pdf`);
      bytes += (await stat(made)).size;
      await this.store(cacheDir, name, key, made, outcome.deps, srcDir, places);
      await rename(made, out);
      built++;
    }
    await this.prune(cacheDir, used);
    log.note(`Typst: ${built} document(s) built, ${cached} unchanged`);
    return { ok: true, bytes, built, cached };
  }

  private async lookup(cacheDir: string, name: string, key: string, places: Places): Promise<string | null> {
    let entry: CacheEntry;
    try {
      entry = JSON.parse(await readFile(path.join(cacheDir, `${name}.json`), "utf8"));
    } catch {
      return null;
    }
    if (entry.format !== 1 || entry.key !== key) return null;
    const now = await hashDeps(Object.keys(entry.deps), places);
    if (!now || JSON.stringify(now) !== JSON.stringify(entry.deps)) return null;
    const pdf = path.join(cacheDir, `${name}.pdf`);
    // A changed or cut PDF is dropped rather than served.
    if (!existsSync(pdf) || (await sha256File(pdf)) !== entry.pdf) return null;
    return pdf;
  }

  private async store(cacheDir: string, name: string, key: string, pdf: string, listed: string[], cwd: string, places: Places) {
    const deps: string[] = [];
    for (const dep of listed) {
      const portableDep = portable(dep, cwd, places);
      // A file outside the known folders: the document is not cached.
      if (!portableDep) return;
      deps.push(portableDep);
    }
    const hashes = await hashDeps(deps, places);
    if (!hashes) return;
    // Under temporary names, then renamed: a build killed half-way leaves no
    // entry pointing at a missing or partial PDF.
    const tmp = path.join(cacheDir, `.${name}.${process.pid}`);
    await copyFile(pdf, `${tmp}.pdf`);
    await rename(`${tmp}.pdf`, path.join(cacheDir, `${name}.pdf`));
    const entry: CacheEntry = { format: 1, key, deps: hashes, pdf: await sha256File(pdf) };
    await writeFile(`${tmp}.json`, JSON.stringify(entry));
    await rename(`${tmp}.json`, path.join(cacheDir, `${name}.json`));
  }

  /** Keeps only what the last build used: the cache never outgrows one build. */
  private async prune(cacheDir: string, used: Set<string>) {
    for (const file of await readdir(cacheDir).catch(() => [] as string[])) {
      const name = file.replace(/\.(json|pdf)$/, "");
      if (!used.has(name)) await rm(path.join(cacheDir, file), { force: true });
    }
  }

  /**
   * Compiles one document for a preview (page preview or the editor's `.typ`
   * preview): through the instance-wide queue, without writing the cache.
   */
  async preview(request: {
    bookId: number;
    jobDir: string;
    srcDir: string;
    job: TypstJob;
    packagePath: string | null;
    fontPath: string | null;
    version: string;
    out: string;
    signal?: AbortSignal;
  }): Promise<CompileOutcome> {
    return this.previewSlots.use(async () => {
      const problem = await checkTree(request.srcDir);
      if (problem) return { ok: false, error: problem, diagnostics: "" };
      let binary: string;
      try {
        binary = await this.binary(request.version);
      } catch (error) {
        return { ok: false, error: (error as Error).message, diagnostics: "" };
      }
      const packageCachePath = typstPackageCache(this.config);
      await mkdir(packageCachePath, { recursive: true });
      const scratch = await mkdtemp(path.join(request.jobDir, "typst-preview-"));
      try {
        const packagePath = await this.packagePath(request.srcDir, request.packagePath, path.join(scratch, "packages"));
        return await compileTypst({
          binary,
          root: request.srcDir,
          job: request.job,
          out: request.out,
          scratch,
          packagePath,
          packageCachePath,
          fontPath: request.fontPath,
          // Fixed, so the same text gives the same bytes and the editor's
          // pane can tell that nothing changed (no reload, no flash).
          creationTimestamp: 0,
          timeoutMs: this.config.typst.timeoutMs,
          memoryMb: this.config.typst.memoryMb,
          maxFileBytes: this.config.bookMaxBytes,
          signal: request.signal,
        });
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    });
  }

  /** Removes a book's cache with the book. */
  async forget(bookId: number) {
    await rm(typstCacheDir(this.config, bookId), { recursive: true, force: true });
  }
}
