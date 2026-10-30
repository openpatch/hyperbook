import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import unzipper from "unzipper";
import { runArchive } from "../archive";
import type { ArchiveInclude } from "@hyperbook/markdown";

let root: string;
let out: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-archive-"));
  out = path.join(root, ".hyperbook", "out");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function entries(name: string): Promise<Record<string, string>> {
  const zip = await unzipper.Open.file(
    path.join(out, "archives", name + ".zip"),
  );
  const result: Record<string, string> = {};
  for (const file of zip.files) {
    if (file.type === "File") {
      result[file.path] = (await file.buffer()).toString("utf8");
    }
  }
  return result;
}

describe("runArchive", () => {
  it("zips every file of an archive folder, including subfolders and dotfiles", async () => {
    const dir = path.join(root, "archives", "projekt");
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "Main.java"), "main");
    fs.writeFileSync(path.join(dir, "src", "Held.java"), "held");
    fs.writeFileSync(path.join(dir, ".vscode"), "settings");

    await runArchive(root, out);

    expect(await entries("projekt")).toEqual({
      "Main.java": "main",
      "src/Held.java": "held",
      ".vscode": "settings",
    });
  });

  it.skipIf(process.platform === "win32")(
    "puts the files behind a symbolic link into the zip, not the link",
    async () => {
      const assets = path.join(root, "book", "kapitel", "assets");
      fs.mkdirSync(path.join(assets, "bilder"), { recursive: true });
      fs.writeFileSync(path.join(assets, "bilder", "held.png"), "png");

      const dir = path.join(root, "archives", "werkstatt");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "Main.java"), "main");
      fs.symlinkSync(
        path.join("..", "..", "book", "kapitel", "assets"),
        path.join(dir, "assets"),
      );

      await runArchive(root, out);

      expect(await entries("werkstatt")).toEqual({
        "Main.java": "main",
        "assets/bilder/held.png": "png",
      });
    },
  );
});

describe("runArchive with includes", () => {
  const include = (
    src: string,
    dest: string,
    source = "/book/page.md",
  ): ArchiveInclude => ({ src, dest, source });

  function projektArchive() {
    const dir = path.join(root, "archives", "projekt");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "Main.java"), "main");
  }

  it("includes a single file", async () => {
    projektArchive();
    fs.mkdirSync(path.join(root, "book", "chapter"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "book", "chapter", "Anleitung.pdf"),
      "pdf",
    );

    await runArchive(root, out, undefined, {
      projekt: [include("/book/chapter/Anleitung.pdf", "docs/Anleitung.pdf")],
    });

    expect(await entries("projekt")).toEqual({
      "Main.java": "main",
      "docs/Anleitung.pdf": "pdf",
    });
  });

  it("includes a directory recursively, with subfolders and dotfiles", async () => {
    projektArchive();
    const assets = path.join(
      root,
      "book",
      "projekte",
      "spielwerkstatt",
      "assets",
    );
    fs.mkdirSync(path.join(assets, "bilder"), { recursive: true });
    fs.writeFileSync(path.join(assets, "bilder", "held.png"), "png");
    fs.writeFileSync(path.join(assets, ".gitignore"), "ignore");
    fs.writeFileSync(path.join(assets, "index.html"), "html");

    await runArchive(root, out, undefined, {
      projekt: [include("/book/projekte/spielwerkstatt/assets", "assets")],
    });

    expect(await entries("projekt")).toEqual({
      "Main.java": "main",
      "assets/bilder/held.png": "png",
      "assets/.gitignore": "ignore",
      "assets/index.html": "html",
    });
  });

  it("supports multiple pairs, also into nested destinations", async () => {
    projektArchive();
    const src = path.join(root, "book", "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, "Held.java"), "held");
    fs.writeFileSync(path.join(root, "README.md"), "readme");

    await runArchive(root, out, undefined, {
      projekt: [
        include("/book/src", "projekt/src/vorlage"),
        include("/README.md", "docs/README.md"),
      ],
    });

    expect(await entries("projekt")).toEqual({
      "Main.java": "main",
      "projekt/src/vorlage/Held.java": "held",
      "docs/README.md": "readme",
    });
  });

  it("fails when an include source is missing", async () => {
    projektArchive();

    await expect(
      runArchive(root, out, undefined, {
        projekt: [include("/book/gibt-es-nicht", "assets")],
      }),
    ).rejects.toThrow(/declared in \/book\/page\.md.*does not exist/);
  });

  it("fails when an include source leaves the book root", async () => {
    projektArchive();

    await expect(
      runArchive(root, out, undefined, {
        projekt: [include("/../../etc/secrets", "secrets")],
      }),
    ).rejects.toThrow(/leaves the book root/);
  });

  it("fails when an include destination collides with the archive folder", async () => {
    projektArchive();
    fs.mkdirSync(path.join(root, "book"), { recursive: true });
    fs.writeFileSync(path.join(root, "book", "Main.java"), "other");

    await expect(
      runArchive(root, out, undefined, {
        projekt: [include("/book/Main.java", "Main.java")],
      }),
    ).rejects.toThrow(/declared in \/book\/page\.md.*already contains it/);
  });

  it("fails when two includes claim the same destination", async () => {
    projektArchive();
    fs.mkdirSync(path.join(root, "book"), { recursive: true });
    fs.writeFileSync(path.join(root, "book", "a.txt"), "a");
    fs.writeFileSync(path.join(root, "book", "b.txt"), "b");

    await expect(
      runArchive(root, out, undefined, {
        projekt: [
          include("/book/a.txt", "sammlung/a.txt"),
          include("/book/b.txt", "sammlung/a.txt"),
        ],
      }),
    ).rejects.toThrow(/already contains it/);
  });

  it("fails when includes are declared for an archive without a folder", async () => {
    // Without any archives folder at all, runArchive skips zipping entirely.
    projektArchive();

    await expect(
      runArchive(root, out, undefined, {
        "gibt-es-nicht": [include("/a.txt", "a.txt")],
      }),
    ).rejects.toThrow(
      /declared for it in \/book\/page\.md, but there is no folder/,
    );
  });

  it("is unchanged without includes", async () => {
    projektArchive();

    await runArchive(root, out, undefined, {});

    expect(await entries("projekt")).toEqual({
      "Main.java": "main",
    });
  });
});
