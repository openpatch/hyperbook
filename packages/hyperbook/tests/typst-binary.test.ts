import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  TypstManifest,
  ensureTypstBinary,
  forgetTypstBinaries,
  resolveTypstVersion,
  supportedTypstVersions,
  typstBinary,
  typstBinaryPath,
  typstManifest,
  typstTarget,
} from "../helpers/typst-binary";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-typst-binary-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const sha = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

it("supports Typst 0.15.0 and newer, for every platform", () => {
  const versions = supportedTypstVersions();
  expect(versions).toContain("0.15.0");
  expect(versions).toContain(typstManifest.default);
  for (const version of versions) {
    expect(version.localeCompare("0.15.0", undefined, { numeric: true })).toBeGreaterThanOrEqual(0);
    expect(Object.keys(typstManifest.versions[version]!).sort()).toEqual([
      "aarch64-apple-darwin",
      "aarch64-unknown-linux-musl",
      "x86_64-apple-darwin",
      "x86_64-pc-windows-msvc",
      "x86_64-unknown-linux-musl",
    ]);
    for (const release of Object.values(typstManifest.versions[version]!)) {
      expect(release!.url).toContain(`/v${version}/`);
      expect(release!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(release!.binarySha256).toMatch(/^[0-9a-f]{64}$/);
    }
  }
});

it("names the release of this machine", () => {
  expect(typstTarget("linux", "x64")).toBe("x86_64-unknown-linux-musl");
  expect(typstTarget("darwin", "arm64")).toBe("aarch64-apple-darwin");
  expect(typstTarget("win32", "x64")).toBe("x86_64-pc-windows-msvc");
  expect(typstTarget("win32", "arm64")).toBeNull();
});

it("uses the pinned version, or the newest with a warning", () => {
  const warn = vi.fn();
  expect(resolveTypstVersion("0.15.0", typstManifest, warn)).toBe("0.15.0");
  expect(warn).not.toHaveBeenCalled();
  expect(resolveTypstVersion(undefined, typstManifest, warn)).toBe(typstManifest.default);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"version"'));
  expect(() => resolveTypstVersion("0.14.2")).toThrow(/Supported versions: 0\.15\.0/);
});

it("prefers HYPERBOOK_TYPST_BINARY", async () => {
  expect(await typstBinary("0.15.1", { HYPERBOOK_TYPST_BINARY: "/opt/typst" })).toBe("/opt/typst");
});

const target = "x86_64-unknown-linux-musl" as const;
const inner = `typst-${target}/typst`;

/**
 * A manifest with one release whose archive is a .tar.xz made here with the
 * system's tar, the way the binary is unpacked on Linux and macOS.
 */
async function tarRelease(binaryContent: string) {
  const source = path.join(dir, "source");
  await fs.mkdir(path.join(source, path.dirname(inner)), { recursive: true });
  await fs.writeFile(path.join(source, inner), binaryContent);
  const archivePath = path.join(dir, "release.tar.xz");
  execFileSync("tar", ["-cJf", archivePath, "-C", source, inner]);
  const archive = await fs.readFile(archivePath);
  const manifest: TypstManifest = {
    format: 1,
    default: "9.9.9",
    versions: {
      "9.9.9": {
        [target]: {
          url: `https://example.com/v9.9.9/typst-${target}.tar.xz`,
          sha256: sha(archive),
          bytes: archive.length,
          format: "tar.xz",
          binary: inner,
          binarySha256: sha(binaryContent),
          binaryBytes: binaryContent.length,
        },
      },
    },
  };
  return { archive, manifest };
}

it("downloads, checks and keeps the binary; the second call reuses it", async () => {
  const { archive, manifest } = await tarRelease("binary!");
  const fetch = vi.fn(async () => new Response(new Uint8Array(archive)));
  const options = { version: "9.9.9", target, cacheDir: dir, manifest, fetch };
  const binary = await ensureTypstBinary(options);
  expect(binary).toBe(typstBinaryPath(dir, "9.9.9", target));
  expect(await fs.readFile(binary, "utf8")).toBe("binary!");
  // No staging folder is left behind.
  expect(await fs.readdir(path.dirname(binary))).toEqual(["typst"]);
  await ensureTypstBinary(options);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("downloads again when the kept binary was changed", async () => {
  const { archive, manifest } = await tarRelease("binary!");
  const fetch = vi.fn(async () => new Response(new Uint8Array(archive)));
  const options = { version: "9.9.9", target, cacheDir: dir, manifest, fetch };
  const binary = await ensureTypstBinary(options);
  await fs.writeFile(binary, "tampered");
  // The next process checks the kept binary and replaces it.
  forgetTypstBinaries();
  expect(await ensureTypstBinary(options)).toBe(binary);
  expect(await fs.readFile(binary, "utf8")).toBe("binary!");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect((await fs.stat(binary)).mode & 0o111).not.toBe(0);
});

it("refuses an archive that does not match its checksum", async () => {
  const { manifest } = await tarRelease("binary!");
  const fetch = vi.fn(async () => new Response(new Uint8Array(Buffer.from("not the zip"))));
  await expect(
    ensureTypstBinary({ version: "9.9.9", target, cacheDir: path.join(dir, "x"), manifest, fetch }),
  ).rejects.toThrow(/checksum/);
  expect(
    await fs.stat(typstBinaryPath(path.join(dir, "x"), "9.9.9", target)).catch(() => null),
  ).toBeNull();
});

it("refuses a binary that does not match its checksum", async () => {
  const { archive, manifest } = await tarRelease("binary!");
  manifest.versions["9.9.9"]![target]!.binarySha256 = sha("something else");
  const fetch = vi.fn(async () => new Response(new Uint8Array(archive)));
  await expect(
    ensureTypstBinary({ version: "9.9.9", target, cacheDir: path.join(dir, "y"), manifest, fetch }),
  ).rejects.toThrow(/binary .* checksum/);
});

it("says when there is no release for the machine", async () => {
  await expect(ensureTypstBinary({ version: "0.15.1", target: null })).rejects.toThrow(
    /HYPERBOOK_TYPST_BINARY/,
  );
});
