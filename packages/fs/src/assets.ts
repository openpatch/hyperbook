import path from "path";
import os from "node:os";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { createHash, randomUUID } from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extract } from "tar";
import {
  elementCoreFiles,
  elementRuntimeFiles,
  DownloadableElement,
} from "@hyperbook/types";

export interface AssetBundle {
  url: string;
  sha256: string;
  bytes: number;
  files: Record<string, number>;
}

export interface AssetManifest {
  format: 1;
  version: string;
  bundles: Record<string, AssetBundle>;
}

export interface AssetOptions {
  /** Use cached and local bundles only; never download. */
  offline?: boolean;
  /** Shared cache for downloaded bundles. Defaults to {@link assetCacheDir}. */
  cacheDir?: string;
  /** Folder with the `directive-*` assets that ship with the host. */
  assetsPath: string;
  /** Asset manifest listing the verified bundle for each element. */
  manifestPath: string;
  /** Folder with `<version>/<element>.tar.gz` archives from a workspace build. */
  bundlesPath: string;
  /** Elements with downloadable bundles. Defaults to every downloadable element. */
  elements?: readonly string[];
}

export function assetCacheDir(): string {
  if (process.env.HYPERBOOK_ASSET_CACHE) {
    return path.resolve(process.env.HYPERBOOK_ASSET_CACHE);
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "hyperbook",
      "assets",
    );
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "hyperbook", "assets");
  }
  return path.join(
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
    "hyperbook",
    "assets",
  );
}

function safePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !path.posix.isAbsolute(value) &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split("/").some((part) => part === ".." || part === ".")
  );
}

/** Large assets live outside the installation, so global and npx installs work too. */
export class AssetManager {
  readonly cacheDir: string;
  private readonly assetsPath: string;
  private readonly manifestPath: string;
  private readonly bundlesPath: string;
  private readonly offline: boolean;
  private readonly remoteDirectives: readonly string[];
  private manifest?: Promise<AssetManifest>;
  private readonly pending = new Map<string, Promise<string>>();

  constructor(options: AssetOptions) {
    this.cacheDir = path.resolve(options.cacheDir || assetCacheDir());
    this.assetsPath = options.assetsPath;
    this.manifestPath = options.manifestPath;
    this.bundlesPath = options.bundlesPath;
    this.offline = options.offline || false;
    this.remoteDirectives = options.elements || Object.keys(elementCoreFiles);
  }

  async readManifest(): Promise<AssetManifest> {
    if (!this.manifest) {
      this.manifest = fs.readFile(this.manifestPath, "utf8").then((text) => {
        const manifest: AssetManifest = JSON.parse(text);
        if (
          manifest.format !== 1 ||
          !manifest.bundles ||
          typeof manifest.version !== "string" ||
          !safePath(manifest.version)
        )
          throw new Error("Invalid Hyperbook asset manifest.");
        for (const [name, bundle] of Object.entries(manifest.bundles)) {
          if (
            !this.remoteDirectives.includes(name) ||
            !bundle.url.startsWith("https://") ||
            !/^[a-f0-9]{64}$/.test(bundle.sha256) ||
            !Number.isSafeInteger(bundle.bytes) ||
            bundle.bytes <= 0 ||
            !bundle.files ||
            Object.keys(bundle.files).length === 0 ||
            Object.entries(bundle.files).some(
              ([file, size]) =>
                !safePath(file) ||
                !file.startsWith(`directive-${name}/`) ||
                !Number.isSafeInteger(size) ||
                size < 0,
            )
          ) {
            throw new Error(`Invalid asset manifest entry: ${name}.`);
          }
        }
        return manifest;
      });
    }
    return this.manifest;
  }

  /** Directives without any assets are valid; missing remote bundles are errors. */
  async ensure(directive: string, cdn = false): Promise<string | undefined> {
    const bundled = path.join(this.assetsPath, `directive-${directive}`);
    try {
      if ((await fs.stat(bundled)).isDirectory()) {
        await Promise.all(
          (cdn
            ? []
            : elementRuntimeFiles[directive as DownloadableElement] || []
          ).map((file) => fs.access(path.join(bundled, file))),
        );
        return bundled;
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
    if (cdn || !this.remoteDirectives.includes(directive)) return undefined;
    const manifest = await this.readManifest();
    const bundle = manifest.bundles[directive];
    if (!bundle)
      throw new Error(
        `Asset manifest has no bundle for ${directive}. Reinstall Hyperbook.`,
      );
    const key = bundle.sha256;
    let pending = this.pending.get(key);
    if (!pending) {
      pending = this.obtain(
        directive,
        bundle,
        path.join(this.bundlesPath, manifest.version, `${directive}.tar.gz`),
      );
      this.pending.set(key, pending);
      pending.catch(() => this.pending.delete(key));
    }
    return pending;
  }

  async copyDirective(
    directive: string,
    assetsOut: string,
    cdn = false,
  ): Promise<void> {
    const source = await this.ensure(directive, cdn);
    if (!source) return;
    const destination = path.join(assetsOut, `directive-${directive}`);
    await fs.mkdir(destination, { recursive: true });
    await fs.cp(source, destination, {
      recursive: true,
      filter(file) {
        if (!cdn) return true;
        const relative = path.relative(source, file).split(path.sep).join("/");
        return (
          !relative ||
          (elementCoreFiles[directive as DownloadableElement]?.includes(
            relative,
          ) ??
            false)
        );
      },
    });
  }

  private async complete(
    destination: string,
    bundle: AssetBundle,
  ): Promise<boolean> {
    try {
      if (
        (await fs.readFile(path.join(destination, ".complete"), "utf8")) !==
        bundle.sha256
      )
        return false;
      for (const [file, size] of Object.entries(bundle.files)) {
        const stat = await fs.lstat(path.join(destination, file));
        if (!stat.isFile() || stat.size !== size) return false;
      }
      return true;
    } catch (error: any) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    }
  }

  private async obtain(
    directive: string,
    bundle: AssetBundle,
    localArchive: string,
  ): Promise<string> {
    const destination = path.join(this.cacheDir, bundle.sha256);
    // A small pointer selects an immutable generation. Replacing that pointer
    // cannot remove files another process is copying, even during cache repair.
    try {
      const generation = await fs.readFile(
        path.join(destination, "current"),
        "utf8",
      );
      if (/^content-[a-f0-9-]+$/.test(generation)) {
        const contents = path.join(destination, generation);
        if (await this.complete(contents, bundle))
          return path.join(contents, `directive-${directive}`);
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
    // Workspace builds can use their verified archives before a release exists.
    const local = (
      await fs.stat(localArchive).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
      })
    )?.isFile();
    if (this.offline && !local) {
      throw new Error(
        `Assets for ${directive} are missing from ${this.cacheDir}. Run "hyperbook assets fetch" online before building with --offline.`,
      );
    }

    await fs.mkdir(destination, { recursive: true });
    const staging = await fs.mkdtemp(path.join(destination, ".download-"));
    const archive = path.join(staging, "bundle.tar.gz");
    const unpacked = path.join(staging, "unpacked");
    try {
      let input;
      if (local) {
        console.log(`[Assets] Using local ${directive} bundle...`);
        input = createReadStream(localArchive);
      } else {
        console.log(`[Assets] Downloading ${directive}...`);
        const response = await fetch(bundle.url, {
          signal: AbortSignal.timeout(300_000),
        });
        if (!response.ok || !response.body)
          throw new Error(`HTTP ${response.status} from ${bundle.url}`);
        input = Readable.fromWeb(response.body as any);
      }
      let bytes = 0;
      const hash = createHash("sha256");
      const verify = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > bundle.bytes)
            return callback(
              new Error("Asset download exceeds its expected size."),
            );
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        input,
        verify,
        createWriteStream(archive, { flags: "wx" }),
      );
      if (bytes !== bundle.bytes || hash.digest("hex") !== bundle.sha256) {
        throw new Error("Asset download failed SHA-256 verification.");
      }
      await fs.mkdir(unpacked);
      let invalidEntry: string | undefined;
      const seen = new Set<string>();
      await extract({
        file: archive,
        cwd: unpacked,
        strict: true,
        filter(entryPath, entry) {
          if (!("type" in entry)) return false;
          const normalized = entryPath.replace(/\/$/, "");
          const directory =
            entry.type === "Directory" &&
            (normalized === `directive-${directive}` ||
              normalized.startsWith(`directive-${directive}/`));
          const file =
            entry.type === "File" &&
            Object.prototype.hasOwnProperty.call(bundle.files, normalized) &&
            entry.size === bundle.files[normalized] &&
            !seen.has(normalized);
          if (!safePath(normalized) || (!directory && !file)) {
            invalidEntry = entryPath;
            return false;
          }
          if (file) seen.add(normalized);
          return true;
        },
      });
      if (invalidEntry)
        throw new Error(`Unexpected asset archive entry: ${invalidEntry}.`);
      await fs.writeFile(path.join(unpacked, ".complete"), bundle.sha256);
      if (!(await this.complete(unpacked, bundle)))
        throw new Error("Asset archive is incomplete.");
      const generation = `content-${randomUUID()}`;
      const contents = path.join(destination, generation);
      await fs.rename(unpacked, contents);
      const pointer = path.join(staging, "current");
      await fs.writeFile(pointer, generation);
      await fs.rename(pointer, path.join(destination, "current"));
      return path.join(contents, `directive-${directive}`);
    } catch (error: any) {
      throw new Error(
        `Could not prepare assets for ${directive}: ${error.message}`,
      );
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }
}
