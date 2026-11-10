import { spawn } from "child_process";
import { createHash } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";
import chalk from "chalk";
import { assetCacheDir } from "@hyperbook/fs";
import typstVersions from "../typst-versions.json";

/*
 * The Typst compiler that turns `.typ` sources into PDFs.
 *
 * Hyperbook supports a fixed set of Typst versions, listed with a SHA-256 per
 * platform in typst-versions.json; a book picks one with `typst.version` in
 * hyperbook.json. The official release archive is downloaded on first use
 * into the asset cache, checked, and the binary in it checked again before it
 * is used. `HYPERBOOK_TYPST_BINARY` points at another binary for development
 * (any version, with a warning).
 */

export type TypstTarget =
  | "x86_64-unknown-linux-musl"
  | "aarch64-unknown-linux-musl"
  | "x86_64-apple-darwin"
  | "aarch64-apple-darwin"
  | "x86_64-pc-windows-msvc";

export type TypstRelease = {
  url: string;
  sha256: string;
  bytes: number;
  format: "tar.xz" | "zip";
  /** The binary's path inside the archive. */
  binary: string;
  binarySha256: string;
  binaryBytes: number;
};

export type TypstManifest = {
  format: 1;
  default: string;
  versions: Record<string, Partial<Record<TypstTarget, TypstRelease>>>;
};

export const typstManifest = typstVersions as TypstManifest;

/** The versions this Hyperbook supports, oldest first. */
export const supportedTypstVersions = (manifest = typstManifest) =>
  Object.keys(manifest.versions);

export class TypstError extends Error {}

/** Typst's name for this machine, or null where there is no release. */
export function typstTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): TypstTarget | null {
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-musl";
  if (platform === "linux" && arch === "arm64") return "aarch64-unknown-linux-musl";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
  return null;
}

/**
 * The Typst version a book asks for: its `typst.version`, or the newest
 * supported one (with a warning that it should be pinned).
 */
export function resolveTypstVersion(
  requested: string | undefined,
  manifest = typstManifest,
  warn: (message: string) => void = () => {},
): string {
  const supported = supportedTypstVersions(manifest);
  if (requested === undefined || requested === "") {
    warn(
      `hyperbook.json does not pin a Typst version; using ${manifest.default}. ` +
        `Add "typst": { "version": "${manifest.default}" } so the book builds the same way later.`,
    );
    return manifest.default;
  }
  if (!supported.includes(requested)) {
    throw new TypstError(
      `Typst ${requested} is not supported by this Hyperbook. Supported versions: ${supported.join(", ")}.`,
    );
  }
  return requested;
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

const run = (command: string, args: string[], cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`)),
    );
  });

/**
 * Takes the binary out of a release archive into `dir`. A `.tar.xz` is
 * unpacked by the system's `tar` (GNU tar with xz, or the BSD tar of macOS);
 * Node itself has no xz.
 */
async function unpackBinary(
  release: TypstRelease,
  archive: string,
  dir: string,
): Promise<string> {
  const out = path.join(dir, path.basename(release.binary));
  if (release.format === "zip") {
    const zip = await unzipper.Open.file(archive);
    const entry = zip.files.find((file) => file.path === release.binary);
    if (!entry) throw new TypstError(`${release.binary} is missing in ${release.url}`);
    await fs.writeFile(out, await entry.buffer());
    return out;
  }
  try {
    await run("tar", ["-xJf", archive, release.binary], dir);
  } catch (error) {
    throw new TypstError(
      `Could not unpack ${path.basename(release.url)} (${(error as Error).message}). ` +
        `It needs a tar that reads .tar.xz files (on Linux: install xz-utils), ` +
        `or set HYPERBOOK_TYPST_BINARY to a typst binary.`,
    );
  }
  await fs.rename(path.join(dir, release.binary), out);
  return out;
}

export type TypstBinaryOptions = {
  version: string;
  target?: TypstTarget | null;
  /** Where binaries are kept; the asset cache by default. */
  cacheDir?: string;
  manifest?: TypstManifest;
  fetch?: typeof fetch;
};

/** Where a version's binary lives in the cache. */
export function typstBinaryPath(
  cacheDir: string,
  version: string,
  target: TypstTarget,
): string {
  return path.join(
    cacheDir,
    "typst",
    version,
    target,
    target.includes("windows") ? "typst.exe" : "typst",
  );
}

const downloads = new Map<string, Promise<string>>();

/**
 * Forgets which binaries this process checked already, so the next use
 * checks them again (a new process does that anyway).
 */
export function forgetTypstBinaries() {
  downloads.clear();
}

/**
 * The path of the checked binary for `version` on this machine, downloaded
 * into the cache when it is not there yet. One download per version at once.
 */
export function ensureTypstBinary(options: TypstBinaryOptions): Promise<string> {
  const manifest = options.manifest ?? typstManifest;
  const target = options.target === undefined ? typstTarget() : options.target;
  if (!target) {
    return Promise.reject(
      new TypstError(
        `There is no Typst release for ${process.platform}/${process.arch}. ` +
          `Set HYPERBOOK_TYPST_BINARY to a typst binary.`,
      ),
    );
  }
  const release = manifest.versions[options.version]?.[target];
  if (!release) {
    return Promise.reject(
      new TypstError(`Typst ${options.version} is not supported for ${target}.`),
    );
  }
  const cacheDir = options.cacheDir ?? assetCacheDir();
  const binary = typstBinaryPath(cacheDir, options.version, target);
  let pending = downloads.get(binary);
  if (!pending) {
    pending = install(release, binary, options.fetch ?? fetch);
    downloads.set(binary, pending);
    pending.catch(() => downloads.delete(binary));
  }
  return pending;
}

async function install(
  release: TypstRelease,
  binary: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  if ((await fs.stat(binary).catch(() => null))?.isFile()) {
    if ((await sha256File(binary)) === release.binarySha256) return binary;
    // Changed or cut short: fetched again below.
  }
  const dir = path.dirname(binary);
  await fs.mkdir(dir, { recursive: true });
  const staging = await fs.mkdtemp(path.join(dir, ".download-"));
  try {
    console.log(
      `${chalk.blue("[Typst]")} Downloading ${path.basename(release.url)} (${Math.round(release.bytes / 1e6)} MB)…`,
    );
    const response = await fetchImpl(release.url, {
      signal: AbortSignal.timeout(600_000),
    });
    if (!response.ok || !response.body) {
      throw new TypstError(`Could not download ${release.url}: HTTP ${response.status}`);
    }
    const archive = path.join(staging, path.basename(release.url));
    await pipeline(
      Readable.fromWeb(response.body as any),
      createWriteStream(archive),
    );
    if ((await sha256File(archive)) !== release.sha256) {
      throw new TypstError(`The download of ${release.url} does not match its checksum.`);
    }
    const unpacked = await unpackBinary(release, archive, staging);
    if ((await sha256File(unpacked)) !== release.binarySha256) {
      throw new TypstError(`The typst binary in ${release.url} does not match its checksum.`);
    }
    await fs.chmod(unpacked, 0o755);
    await fs.rename(unpacked, binary);
    return binary;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

let warnedOverride = false;

/**
 * The binary to compile with: `HYPERBOOK_TYPST_BINARY` when set, otherwise
 * the checked binary of `version`.
 */
export async function typstBinary(
  version: string,
  env: NodeJS.ProcessEnv = process.env,
  options: Omit<TypstBinaryOptions, "version"> = {},
): Promise<string> {
  const override = env.HYPERBOOK_TYPST_BINARY;
  if (override) {
    if (!warnedOverride) {
      warnedOverride = true;
      console.warn(
        `${chalk.yellow("[Typst]")} Using ${override} (HYPERBOOK_TYPST_BINARY) instead of Typst ${version}; its version is not checked.`,
      );
    }
    return override;
  }
  return ensureTypstBinary({ ...options, version });
}
