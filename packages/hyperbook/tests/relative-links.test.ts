import { describe, expect, it } from "vitest";
import path from "path";
import { HyperbookPage, Hyperproject } from "@hyperbook/types";
import { makeBaseCtx } from "../build";

const root = path.join(path.sep, "tmp", "book");
const project = { name: "T", src: root, type: "book" } as Hyperproject;
const { makeUrl } = makeBaseCtx(root, {} as any, undefined, project);

/** A page of `folder` (book or glossary) at `file`, e.g. "sub/term.md". */
const pageAt = (folder: "book" | "glossary", file: string, href: string): HyperbookPage => ({
  name: "Page",
  href,
  path: {
    directory: path.posix.dirname(file) === "." ? "" : path.posix.dirname(file),
    relative: file,
    absolute: path.join(root, folder, file),
    href,
    permalink: null,
  },
});

describe("relative links resolve against the page's folder", () => {
  it("in book/", () => {
    expect(makeUrl("./pic.png", "public", pageAt("book", "a/b.md", "/a/b"))).toBe("/a/pic.png");
    expect(makeUrl("./pic.png", "public", pageAt("book", "a/index.md", "/a"))).toBe("/a/pic.png");
  });

  it("in glossary/, which is served under /glossary", () => {
    expect(makeUrl("./pic.png", "public", pageAt("glossary", "term.md", "/glossary/term"))).toBe(
      "/glossary/pic.png",
    );
    expect(makeUrl("./pic.png", "public", pageAt("glossary", "sub/term.md", "/glossary/sub/term"))).toBe(
      "/glossary/sub/pic.png",
    );
    expect(makeUrl("./pic.png", "public", pageAt("glossary", "index.md", "/glossary"))).toBe(
      "/glossary/pic.png",
    );
    // A link up leaves the glossary for the book.
    expect(makeUrl("../logo.png", "public", pageAt("glossary", "term.md", "/glossary/term"))).toBe("/logo.png");
  });
});
