import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { PageRenderer, normalizeHref } from "../render";

let root: string;
let renderer: PageRenderer;

const write = async (file: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};
const out = (file: string) =>
  fs.readFile(path.join(root, ".hyperbook", "out", file), "utf8");

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-render-"));
  await write("hyperbook.json", JSON.stringify({ name: "Book", search: true }));
  await write("book/index.md", "---\nname: Start\n---\n\n# Start\n");
  await write("book/chapter/loops.md", "---\nname: Loops\n---\n\n# Loops\n");
  await write("glossary/oop.md", "---\nname: OOP\n---\n\nObjects.\n");
  const project: Hyperproject = { name: "Book", src: root, type: "book" };
  renderer = new PageRenderer(root, project);
  await renderer.prepare();
}, 60_000);

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("rendering single pages", () => {
  it("prepares Hyperbook's assets and nothing else", async () => {
    const assets = await fs.readdir(path.join(root, ".hyperbook", "out", "__hyperbook_assets"));
    expect(assets).toContain("i18n.js");
    expect(assets).toContain("search.js");
    expect(assets.some((a) => a.startsWith("directive-"))).toBe(false);
    await expect(out("index.html")).rejects.toThrow();
  });

  it("renders a page by file and only that page", async () => {
    const result = await renderer.render({ file: "book/chapter/loops.md" });
    expect(result).toEqual({ ok: true, href: "/chapter/loops", title: "Loops", file: "book/chapter/loops.md", out: "chapter/loops.html" });
    expect(await out("chapter/loops.html")).toContain("Loops");
    await expect(out("index.html")).rejects.toThrow();
  });

  it("renders a page by address, also glossary entries", async () => {
    expect(await renderer.render({ href: "/" })).toMatchObject({ ok: true, out: "index.html" });
    expect(await renderer.render({ href: "/glossary/oop.html" })).toMatchObject({ ok: true, href: "/glossary/oop" });
    expect(await renderer.render({ href: "/nothing" })).toEqual({ ok: false, error: "There is no page here" });
  });

  it("reads changes on disk and copies the runtimes a page uses", async () => {
    await write("book/index.md", "---\nname: Start\n---\n\n:::alert{info}\nChanged\n:::\n");
    await renderer.render({ file: "book/index.md" });
    expect(await out("index.html")).toContain("Changed");
    const assets = await fs.readdir(path.join(root, ".hyperbook", "out", "__hyperbook_assets"));
    expect(assets).toContain("directive-alert");
  });

  it("normalizes addresses", () => {
    expect(normalizeHref("/a/b/index.html")).toBe("/a/b");
    expect(normalizeHref("/a/b/")).toBe("/a/b");
    expect(normalizeHref("/index.html?x=1")).toBe("/");
    expect(normalizeHref("/")).toBe("/");
  });
});

describe("diagnostics of single pages", () => {
  const page = [
    "---",
    "name: Notes",
    "---",
    "",
    "[Loops](/chapter/loops) and [nowhere](/nowhere).",
    "",
    "![Logo](/logo.png)",
    "",
    ':download[Get it]{src="/missing.zip"}',
    "",
  ].join("\n");

  it("comes with a render when asked for, placed in the page's source", async () => {
    await write("public/logo.png", "png");
    renderer.invalidate();
    await write("book/notes.md", page);
    const { result, diagnostics } = await renderer.renderPage(
      { file: "book/notes.md" },
      { diagnostics: true },
    );
    expect(result.ok).toBe(true);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "book/notes.md", line: 5, severity: "error", rule: "broken-link" }),
        expect.objectContaining({ file: "book/notes.md", line: 9, severity: "warning", rule: "missing-file" }),
      ]),
    );
    // The public file exists and the page linked to does, too.
    expect(diagnostics).toHaveLength(2);
    // Without asking, there are none (the dev server's indexer).
    expect((await renderer.renderPage({ file: "book/notes.md" })).diagnostics).toBeUndefined();
  });

  it("can be had without rendering", async () => {
    await fs.rm(path.join(root, ".hyperbook", "out", "notes.html"), { force: true });
    const linted = await renderer.lintPage({ file: "book/notes.md" });
    expect(linted?.file).toBe("book/notes.md");
    expect(linted?.diagnostics.map((d) => d.rule).sort()).toEqual(["broken-link", "missing-file"]);
    await expect(out("notes.html")).rejects.toThrow();
    expect(await renderer.lintPage({ file: "book/none.md" })).toBeNull();
  });

  it("keeps the public files until invalidated", async () => {
    await fs.rm(path.join(root, "public", "logo.png"));
    expect((await renderer.lintPage({ file: "book/notes.md" }))?.diagnostics).toHaveLength(2);
    renderer.invalidate();
    expect((await renderer.lintPage({ file: "book/notes.md" }))?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ line: 7, rule: "broken-link" })]),
    );
  });

  it("points at where a page broke", async () => {
    await write("book/broken.md", "---\nname: Broken\n---\n\nText\n\n::youtube\n");
    const { result, diagnostics } = await renderer.renderPage(
      { file: "book/broken.md" },
      { diagnostics: true },
    );
    expect(result.ok).toBe(false);
    expect(diagnostics?.[0]).toMatchObject({ file: "book/broken.md", line: 7, severity: "error" });
    await fs.rm(path.join(root, "book", "broken.md"));
  });

  // Unknown options need the schemas a built CLI ships (see check.ts).
  it("of the book as a whole: permaids claimed twice", async () => {
    await write("book/a.md", "---\nname: A\npermaid: same\n---\n\nA\n");
    await write("book/b.md", "---\nname: B\npermaid: same\n---\n\nB\n");
    const diagnostics = await renderer.lintBook();
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "book/a.md", line: 3, rule: "duplicate-permaid", severity: "error" }),
      ]),
    );
    await fs.rm(path.join(root, "book", "a.md"));
    await fs.rm(path.join(root, "book", "b.md"));
  });
});
