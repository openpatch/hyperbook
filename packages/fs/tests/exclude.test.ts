import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { excludeMatcher, globToRegExp } from "../src/exclude";
import * as vfile from "../src/vfile";

describe("globToRegExp", () => {
  const matches = (glob: string, address: string) =>
    globToRegExp(glob).test(address);

  it("keeps * inside one folder", () => {
    expect(matches("*.pdf", "a.pdf")).toBe(true);
    expect(matches("*.pdf", "docs/a.pdf")).toBe(false);
    expect(matches("docs/*.pdf", "docs/a.pdf")).toBe(true);
  });

  it("lets ** cross folders, and **/ match none", () => {
    expect(matches("intern/**", "intern/a.pdf")).toBe(true);
    expect(matches("intern/**", "intern/deep/a.pdf")).toBe(true);
    expect(matches("intern/**", "internal/a.pdf")).toBe(false);
    expect(matches("**/*.typ", "a.typ")).toBe(true);
    expect(matches("**/*.typ", "x/y/a.typ")).toBe(true);
    expect(matches("**/*.draft.*", "x/a.draft.pdf")).toBe(true);
  });

  it("supports ? and alternatives", () => {
    expect(matches("a?.pdf", "a1.pdf")).toBe(true);
    expect(matches("a?.pdf", "a/.pdf")).toBe(false);
    expect(matches("*.{pdf,typ}", "a.typ")).toBe(true);
    expect(matches("*.{pdf,typ}", "a.png")).toBe(false);
  });

  it("treats everything else as literal", () => {
    expect(matches("a.pdf", "axpdf")).toBe(false);
    expect(matches("a+(b).pdf", "a+(b).pdf")).toBe(true);
    expect(matches("{a,b", "a")).toBe(true);
  });
});

describe("excludeMatcher", () => {
  it("matches nothing without globs", () => {
    expect(excludeMatcher(undefined)("a.pdf")).toBe(false);
    expect(excludeMatcher([])("a.pdf")).toBe(false);
  });

  it("ignores leading slashes on both sides", () => {
    const excluded = excludeMatcher(["/intern/**"]);
    expect(excluded("/intern/a.pdf")).toBe(true);
    expect(excluded("intern/a.pdf")).toBe(true);
    expect(excluded("/other/a.pdf")).toBe(false);
  });
});

describe("exclude in listings", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const dir of dirs.splice(0)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  async function book(exclude: string[] | undefined) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-exclude-"));
    dirs.push(root);
    const write = async (file: string, content = "x") => {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), content);
    };
    await write("hyperbook.json", JSON.stringify({ name: "Test", exclude }));
    await write("book/index.md", "# Hi");
    await write("book/sheet.pdf");
    await write("book/intern/exam.pdf");
    await write("book/notes.draft.pdf");
    await write("public/logo.png");
    await write("public/intern/key.pdf");
    await write("glossary/term.md", "# Term");
    await write("glossary/intern.draft.png");
    return root;
  }

  const hrefs = async (root: string) =>
    (
      await Promise.all(
        (["public", "book-public", "glossary-public"] as const).map((folder) =>
          vfile.listForFolder(root, folder as any),
        ),
      )
    )
      .flat()
      .map((file) => file.path.href)
      .sort();

  it("lists every copied file without the setting", async () => {
    expect(await hrefs(await book(undefined))).toEqual([
      "/glossary/intern.draft.png",
      "/intern/exam.pdf",
      "/intern/key.pdf",
      "/logo.png",
      "/notes.draft.pdf",
      "/sheet.pdf",
    ]);
  });

  it("leaves excluded files out of public/, book/ and glossary/", async () => {
    expect(await hrefs(await book(["intern/**", "**/*.draft.*"]))).toEqual([
      "/logo.png",
      "/sheet.pdf",
    ]);
  });

  it("never excludes pages", async () => {
    const root = await book(["**"]);
    const pages = await vfile.listForFolder(root, "book");
    expect(pages.map((page) => page.path.href)).toEqual(["/"]);
  });
});
