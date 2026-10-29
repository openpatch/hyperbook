import { describe, expect, it } from "vitest";
import { fileAt } from "../src/web/pages/editor/files";

const files = [
  "book/index.md",
  "book/a/index.md",
  "book/a/b.md",
  "book/a/c.md.hbs",
  "book/a/img.png",
  "book/Über uns.md",
  "glossary/term.md",
  "public/logo.svg",
];

describe("the file a preview link shows", () => {
  it("finds pages, index pages too", () => {
    expect(fileAt("/", files)).toBe("book/index.md");
    expect(fileAt("/a", files)).toBe("book/a/index.md");
    expect(fileAt("/a/", files)).toBe("book/a/index.md");
    expect(fileAt("/a/b", files)).toBe("book/a/b.md");
    expect(fileAt("/a/b.html", files)).toBe("book/a/b.md");
    expect(fileAt("/a/c#part", files)).toBe("book/a/c.md.hbs");
    expect(fileAt("/glossary/term", files)).toBe("glossary/term.md");
    expect(fileAt("/%C3%9Cber%20uns", files)).toBe("book/Über uns.md");
  });

  it("finds files, and nothing where no file is", () => {
    expect(fileAt("/a/img.png", files)).toBe("book/a/img.png");
    expect(fileAt("/logo.svg?v=1", files)).toBe("public/logo.svg");
    expect(fileAt("/search", files)).toBeNull();
    expect(fileAt("/%E0%A4%A", files)).toBeNull();
  });
});
