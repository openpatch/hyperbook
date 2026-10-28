import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { ZipError, extractBook } from "../src/server/hosting/zip";

const limits = { maxBytes: 1024 * 1024, maxEntries: 100 };
const dirs: string[] = [];

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cloud-zip-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

const text = (s: string) => new TextEncoder().encode(s);

async function unpack(files: Zippable, l = limits) {
  const dir = await tmp();
  const zip = path.join(dir, "upload.zip");
  await writeFile(zip, zipSync(files));
  const dest = path.join(dir, "out");
  const result = await extractBook(zip, dest, l);
  return { result, dest };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort();
}

describe("extractBook", () => {
  it("unpacks a book at the zip root", async () => {
    const { result, dest } = await unpack({
      "hyperbook.json": text("{}"),
      "book/index.md": text("# Hi"),
    });
    expect(result).toMatchObject({ root: "", files: 2 });
    expect(await listFiles(dest)).toEqual(["book/index.md", "hyperbook.json"]);
  });

  it("finds the book inside a top folder, as in a GitHub download", async () => {
    const { result, dest } = await unpack({
      "repo-main/README.md": text("outside"),
      "repo-main/docs/hyperbook.json": text("{}"),
      "repo-main/docs/book/index.md": text("# Hi"),
    });
    expect(result.root).toBe("repo-main/docs");
    expect(await listFiles(dest)).toEqual(["book/index.md", "hyperbook.json"]);
  });

  it("takes a library root over the books inside it", async () => {
    const { result } = await unpack({
      "lib/hyperlibrary.json": text("{}"),
      "lib/en/hyperbook.json": text("{}"),
      "lib/de/hyperbook.json": text("{}"),
    });
    expect(result.root).toBe("lib");
  });

  it("skips clutter", async () => {
    const { dest } = await unpack({
      "hyperbook.json": text("{}"),
      "__MACOSX/._hyperbook.json": text("x"),
      ".DS_Store": text("x"),
      "node_modules/a/index.js": text("x"),
      ".hyperbook/out/index.html": text("x"),
    });
    expect(await listFiles(dest)).toEqual(["hyperbook.json"]);
  });

  it("refuses a zip without a book", async () => {
    await expect(unpack({ "index.md": text("# Hi") })).rejects.toThrow(/no hyperbook.json/);
  });

  it("refuses two books side by side", async () => {
    await expect(
      unpack({ "a/hyperbook.json": text("{}"), "b/hyperbook.json": text("{}") }),
    ).rejects.toThrow(/several books/);
  });

  it.each([
    ["../evil.txt"],
    ["book/../../evil.txt"],
    ["/etc/evil"],
    ["C:/evil"],
    ["..\\evil.txt"],
  ])("refuses the path %s", async (name) => {
    await expect(unpack({ "hyperbook.json": text("{}"), [name]: text("x") })).rejects.toThrow(
      ZipError,
    );
  });

  it("refuses .git folders", async () => {
    await expect(
      unpack({ "hyperbook.json": text("{}"), ".git/config": text("x") }),
    ).rejects.toThrow(/\.git/);
    await expect(
      unpack({ "hyperbook.json": text("{}"), "book/.GIT/hooks/x": text("x") }),
    ).rejects.toThrow(/\.git/);
  });

  it("refuses books larger than the limit", async () => {
    await expect(
      unpack(
        { "hyperbook.json": text("{}"), "big.bin": new Uint8Array(2048) },
        { maxBytes: 1024, maxEntries: 100 },
      ),
    ).rejects.toThrow(/larger than/);
  });

  it("refuses too many entries", async () => {
    const files: Zippable = { "hyperbook.json": text("{}") };
    for (let i = 0; i < 5; i++) files[`f${i}.md`] = text("x");
    await expect(unpack(files, { maxBytes: 1024 * 1024, maxEntries: 3 })).rejects.toThrow(
      /more than 3 files/,
    );
  });

  it("leaves out symlinks instead of writing them", async () => {
    const { result, dest } = await unpack({
      "hyperbook.json": text("{}"),
      // Unix mode 0120777 (symlink) in the upper half of the attributes.
      link: [text("/etc/passwd"), { os: 3, attrs: (0o120777 << 16) >>> 0 }],
    });
    expect(result.skipped).toEqual(["link"]);
    expect(await listFiles(dest)).toEqual(["hyperbook.json"]);
  });

  it("refuses garbage", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "x.zip"), "not a zip");
    await expect(extractBook(path.join(dir, "x.zip"), path.join(dir, "out"), limits)).rejects.toThrow(
      /not a valid zip/,
    );
  });

  it("keeps file contents intact", async () => {
    const { dest } = await unpack({ "hyperbook.json": text('{"name":"Ä"}') });
    expect(await readFile(path.join(dest, "hyperbook.json"), "utf8")).toBe('{"name":"Ä"}');
  });
});
