import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";
import {
  assetCacheDir,
  cliRuntimeManifest,
  ensureRuntime,
  localElements,
  sharedAssetsBase,
} from "./runtimes";

/*
 * Runs `hyperbook build` on a checked-out book in a sandboxed child process.
 * Books are written by teachers, so the build is treated as untrusted:
 *
 * - Node's permission model limits it to reading the CLI, its runtime
 *   archives, the shared asset cache and the job directory, and writing the
 *   asset cache and the job directory. No child processes, workers or native
 *   addons — so no book content can make the build write anything but what
 *   Hyperbook itself writes into those two places.
 * - It gets an empty environment, so no secret of the server reaches it.
 * - Heap and wall-clock time are capped.
 *
 * The permission model does not restrict network access; the build needs
 * none (--offline), and operators who want a guarantee limit egress.
 */

export type BuildOutcome =
  | { ok: true; outDir: string; sizeBytes: number }
  | { ok: false; error: string };

export type Runner = (job: {
  config: Config;
  jobDir: string;
  srcDir: string;
  log: BuildLog;
  signal: AbortSignal;
  /** Elements whose runtimes the admin loads from their public CDN, not this instance. */
  cdnElements: string[];
}) => Promise<BuildOutcome>;

/**
 * The flags of Node's permission model every CLI child process runs under,
 * builds and page renderers alike: the CLI and its runtime archives and the
 * job directory to read, the job directory and the shared asset cache to
 * write. The cache outlives a single job, so runtimes already unpacked for
 * one build are reused by the next (the sandbox runs --offline; without this
 * it would unpack the archives again for every job).
 */
export function cliPermissions(config: Config, jobDir: string): string[] {
  const cliDir = path.dirname(config.build.cli);
  return [
    "--permission",
    `--allow-fs-read=${cliDir}`,
    `--allow-fs-read=${path.join(cliDir, "..", ".cache")}`,
    `--allow-fs-read=${jobDir}`,
    `--allow-fs-write=${jobDir}`,
    `--allow-fs-read=${assetCacheDir(config)}`,
    `--allow-fs-write=${assetCacheDir(config)}`,
  ];
}

/**
 * The environment of a CLI child process: empty of the server's secrets, but
 * pointing at the shared asset cache — and, when the instance serves element
 * runtimes itself (hosting/runtimes.ts), at the address it serves them from,
 * so builds copy only the small integration scripts into books instead of
 * ~500 MB of runtimes. Books that ask for a custom CDN (elements.*.cdn) or a
 * local copy (cdn: false) are not affected; elements the admin set to their
 * public CDN (instance settings) load from there instead of the instance.
 */
export async function cliChildEnv(
  config: Config,
  jobDir: string,
  cdn: readonly string[] = [],
): Promise<Record<string, string>> {
  // The permission flags need the cache to exist.
  await mkdir(assetCacheDir(config), { recursive: true });
  const local = localElements(config, cdn);
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: jobDir,
    NODE_ENV: "production",
    NO_COLOR: "1",
    HYPERBOOK_ASSET_CACHE: assetCacheDir(config),
    // The admin's choice, even when nothing is served locally: it replaces
    // the built-in default (PyIDE on a CDN, the rest local) for books that
    // do not decide in their hyperbook.json.
    ...(cdn.length > 0 ? { HYPERBOOK_CDN_ELEMENTS: cdn.join(",") } : {}),
    ...(local ? { HYPERBOOK_SHARED_ASSETS_BASE: sharedAssetsBase(cliRuntimeManifest(config)!.version) } : {}),
  };
}

const LOG_LIMIT = 256 * 1024;

/**
 * Collects a build's output as plain text: ANSI codes removed and progress
 * lines (redrawn in place with \r or "erase line") reduced to their last state.
 * Keeps the end of overly long logs, where the errors are.
 */
export class BuildLog {
  private lines: string[] = [];
  private size = 0;
  private partial = "";
  private cut = false;
  private replacements: [string, string][] = [];

  /** Replaces `from` in every line, e.g. server paths teachers need not see. */
  redact(from: string, to: string) {
    this.replacements.push([from, to]);
  }

  write(chunk: string) {
    const parts = (this.partial + chunk).split("\n");
    this.partial = parts.pop()!;
    for (const raw of parts) {
      const line = this.clean(raw);
      // Lines that only erased a progress line leave nothing worth keeping.
      if (line || !raw.includes("\x1b")) this.push(line);
    }
  }

  private clean(raw: string): string {
    let line = clean(raw);
    for (const [from, to] of this.replacements) line = line.replaceAll(from, to);
    return line;
  }

  /** A line of the platform's own, between the build's output. */
  note(message: string) {
    this.flush();
    this.push(`[Hyperbook Cloud] ${message}`);
  }

  private flush() {
    if (this.partial) {
      this.push(this.clean(this.partial));
      this.partial = "";
    }
  }

  private push(line: string) {
    this.lines.push(line);
    this.size += line.length + 1;
    while (this.size > LOG_LIMIT && this.lines.length > 1) {
      this.size -= this.lines.shift()!.length + 1;
      this.cut = true;
    }
  }

  /** Restores text stored with a queued build, e.g. a note from its upload. */
  replay(text: string) {
    this.write(text.endsWith("\n") ? text : `${text}\n`);
  }

  /** The newest line matching `pattern`, including one still being written. */
  findLast(pattern: RegExp): RegExpMatchArray | null {
    const partial = this.partial ? pattern.exec(this.clean(this.partial)) : null;
    if (partial) return partial;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const match = pattern.exec(this.lines[i]!);
      if (match) return match;
    }
    return null;
  }

  toString(): string {
    const current = this.partial ? [this.clean(this.partial)] : [];
    const head = this.cut ? ["[Hyperbook Cloud] (earlier output cut)"] : [];
    return [...head, ...this.lines, ...current].join("\n");
  }
}

function clean(raw: string): string {
  const segments = raw.split(/\r|\x1b\[1G/);
  const last = [...segments].reverse().find((s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trim());
  return (last ?? "").replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trimEnd();
}

let cachedVersion: { cli: string; version: string | null } | null = null;

/** Version of the Hyperbook CLI that builds books, recorded with each build. */
export function hyperbookVersion(config: Config): string | null {
  if (cachedVersion?.cli !== config.build.cli) {
    let version: string | null = null;
    try {
      const pkg = path.join(path.dirname(config.build.cli), "..", "package.json");
      version = JSON.parse(readFileSync(pkg, "utf8")).version ?? null;
    } catch {
      version = null;
    }
    cachedVersion = { cli: config.build.cli, version };
    return version;
  }
  return cachedVersion.version;
}

/**
 * Adapts hyperbook.json to the platform. Only the checkout is changed, never
 * the repository.
 *
 * - Books are served at the root of their own host, so a basePath (meant for
 *   GitHub Pages and the like) would break every link.
 * - Student login and saving go to the book's own host (`/_hyperbook/api`),
 *   so `cloud` is set to same-origin mode, whatever the book said.
 */
export async function adaptConfig(srcDir: string, log: BuildLog) {
  const file = path.join(srcDir, "hyperbook.json");
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return; // Missing or invalid: the build reports it.
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  if ("basePath" in json) {
    log.note(`Ignoring "basePath": ${JSON.stringify(json.basePath)}; books are served at the root of their address.`);
    delete json.basePath;
  }
  if ("cloud" in json && JSON.stringify(json.cloud) !== '{"sameOrigin":true}') {
    log.note(`Ignoring "cloud": ${JSON.stringify(json.cloud)}; students log in to this platform.`);
  }
  json.cloud = { sameOrigin: true };
  await writeFile(file, JSON.stringify(json, null, 2));
}

/** Total size of a build's files. Refuses links: output must be plain files. */
async function outputSize(dir: string, elements = new Set<string>()): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) {
      throw new Error(`The build produced a link (${path.relative(dir, full)}), which is not allowed`);
    }
    if (stat.isDirectory()) {
      // A book with a shared runtime keeps its small integration files in
      // __hyperbook_assets/directive-<element>/; that is which elements it uses.
      if (path.basename(dir) === "__hyperbook_assets" && /^directive-[a-z0-9-]+$/.test(entry.name))
        elements.add(entry.name.slice("directive-".length));
      total += await outputSize(full, elements);
    } else {
      total += stat.size;
    }
  }
  return total;
}

export const sandboxedRunner: Runner = async ({ config, jobDir, srcDir, log, signal, cdnElements }) => {
  if (signal.aborted) return { ok: false, error: "The build was canceled" };
  const cli = config.build.cli;
  if (!existsSync(cli)) {
    return {
      ok: false,
      error: `The Hyperbook CLI is missing at ${cli}. Build it with: pnpm --filter hyperbook build`,
    };
  }
  await adaptConfig(srcDir, log);

  // Element runtimes the CLI's own build packs into .cache/asset-bundles;
  // offline builds unpack them from there. See
  // packages/hyperbook/helpers/assets.ts and hosting/runtimes.ts.
  const local = localElements(config, cdnElements);
  if (local)
    log.note(
      `Element runtimes are served by this instance at ${sharedAssetsBase(
        cliRuntimeManifest(config)!.version,
      )} unless the book, or this instance's settings, choose otherwise.`,
    );
  const env = await cliChildEnv(config, jobDir, cdnElements);
  const args = [
    ...cliPermissions(config, jobDir),
    `--max-old-space-size=${config.build.memoryMb}`,
    cli,
    "build",
    "--offline",
  ];

  const child = spawn(process.execPath, args, {
    cwd: srcDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  log.redact(srcDir, "<book>");
  child.stdout.setEncoding("utf8").on("data", (d: string) => log.write(d));
  child.stderr.setEncoding("utf8").on("data", (d: string) => log.write(d));

  let stopped: string | null = null;
  const stop = (reason: string) => {
    stopped ??= reason;
    child.kill("SIGKILL");
  };
  const timer = setTimeout(
    () => stop(`The build took longer than ${config.build.timeoutMs / 1000} seconds and was stopped`),
    config.build.timeoutMs,
  );
  const onAbort = () => stop("The build was canceled");
  signal.addEventListener("abort", onAbort);

  const { code, sig } = await new Promise<{ code: number | null; sig: NodeJS.Signals | null }>(
    (resolve) => {
      child.on("error", (error) => {
        stopped ??= `The build could not start: ${error.message}`;
        resolve({ code: null, sig: null });
      });
      child.on("close", (code, sig) => resolve({ code, sig }));
    },
  );
  clearTimeout(timer);
  signal.removeEventListener("abort", onAbort);

  if (stopped) return { ok: false, error: stopped };
  if (code !== 0) {
    return {
      ok: false,
      error: sig ? `The build was killed (${sig}); it may have run out of memory` : `The build failed (exit code ${code})`,
    };
  }

  const outDir = path.join(srcDir, ".hyperbook", "out");
  if (!existsSync(outDir)) return { ok: false, error: "The build produced no output" };
  const elements = new Set<string>();
  let sizeBytes: number;
  try {
    sizeBytes = await outputSize(outDir, elements);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (sizeBytes > config.bookMaxBytes) {
    return {
      ok: false,
      error: `The built book is larger than ${Math.floor(config.bookMaxBytes / 1024 / 1024)} MB`,
    };
  }
  // The book links to the shared runtimes of the elements it uses; extract
  // them now, in the background, so the first reader does not wait for it.
  // One extraction per Hyperbook version serves every book (hosting/runtimes.ts).
  if (local) {
    const version = cliRuntimeManifest(config)!.version;
    const used = [...elements].filter((element) => local.includes(element));
    void Promise.all(used.map((element) => ensureRuntime(config, version, element)));
  }
  return { ok: true, outDir, sizeBytes };
};
