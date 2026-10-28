import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";

/*
 * Runs `hyperbook build` on a checked-out book in a sandboxed child process.
 * Books are written by teachers, so the build is treated as untrusted:
 *
 * - Node's permission model limits it to reading the CLI, its asset cache and
 *   the job directory, and writing the job directory. No child processes,
 *   workers or native addons.
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
}) => Promise<BuildOutcome>;

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
async function adaptConfig(srcDir: string, log: BuildLog) {
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
async function outputSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) {
      throw new Error(`The build produced a link (${path.relative(dir, full)}), which is not allowed`);
    }
    total += stat.isDirectory() ? await outputSize(full) : stat.size;
  }
  return total;
}

export const sandboxedRunner: Runner = async ({ config, jobDir, srcDir, log, signal }) => {
  if (signal.aborted) return { ok: false, error: "The build was canceled" };
  const cli = config.build.cli;
  if (!existsSync(cli)) {
    return {
      ok: false,
      error: `The Hyperbook CLI is missing at ${cli}. Build it with: pnpm --filter hyperbook build`,
    };
  }
  await adaptConfig(srcDir, log);

  const cliDir = path.dirname(cli);
  // Element runtimes the CLI's own build packs into .cache/asset-bundles;
  // offline builds unpack them into the job directory. See
  // packages/hyperbook/helpers/assets.ts.
  const assetCache = path.join(cliDir, "..", ".cache");
  const args = [
    "--permission",
    `--allow-fs-read=${cliDir}`,
    `--allow-fs-read=${assetCache}`,
    `--allow-fs-read=${jobDir}`,
    `--allow-fs-write=${jobDir}`,
    `--max-old-space-size=${config.build.memoryMb}`,
    cli,
    "build",
    "--offline",
  ];

  const child = spawn(process.execPath, args, {
    cwd: srcDir,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: jobDir, NODE_ENV: "production", NO_COLOR: "1" },
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
  let sizeBytes: number;
  try {
    sizeBytes = await outputSize(outDir);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (sizeBytes > config.bookMaxBytes) {
    return {
      ok: false,
      error: `The built book is larger than ${Math.floor(config.bookMaxBytes / 1024 / 1024)} MB`,
    };
  }
  return { ok: true, outDir, sizeBytes };
};
