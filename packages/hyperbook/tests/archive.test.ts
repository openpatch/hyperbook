import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import unzipper from "unzipper";
import { runArchive } from "../archive";

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
  const zip = await unzipper.Open.file(path.join(out, "archives", name + ".zip"));
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
      fs.symlinkSync(path.join("..", "..", "book", "kapitel", "assets"), path.join(dir, "assets"));

      await runArchive(root, out);

      expect(await entries("werkstatt")).toEqual({
        "Main.java": "main",
        "assets/bilder/held.png": "png",
      });
    },
  );
});
