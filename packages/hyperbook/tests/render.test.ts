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
    expect(result).toEqual({ ok: true, href: "/chapter/loops", file: "book/chapter/loops.md", out: "chapter/loops.html" });
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
