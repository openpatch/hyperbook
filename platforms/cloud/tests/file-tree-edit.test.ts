import { describe, expect, it } from "vitest";
import { dropPath, linkTo } from "../src/web/pages/editor/file-drop";
import { editTarget, outermost } from "../src/web/pages/editor/file-tree";
import { starter } from "../src/web/pages/editor/files";

describe("names typed into the file tree", () => {
  it("puts a new file into its folder", () => {
    expect(editTarget({ kind: "file", folder: "book/a" }, "b.md")).toBe("book/a/b.md");
    expect(editTarget({ kind: "file", folder: "" }, "notes.txt")).toBe("notes.txt");
    expect(editTarget({ kind: "file", folder: "book" }, "x/y.md")).toBe("book/x/y.md");
  });

  it("makes a page of a name without an extension in book/ or glossary/", () => {
    expect(editTarget({ kind: "file", folder: "book" }, " intro ")).toBe("book/intro.md");
    expect(editTarget({ kind: "file", folder: "glossary" }, "term")).toBe("glossary/term.md");
    expect(editTarget({ kind: "file", folder: "public" }, "LICENSE")).toBe("public/LICENSE");
    expect(editTarget({ kind: "folder", folder: "book" }, "part")).toBe("book/part");
  });

  it("renames in the same folder", () => {
    expect(editTarget({ kind: "rename", path: "book/a/old.md", isFolder: false }, "new.md")).toBe(
      "book/a/new.md",
    );
    expect(editTarget({ kind: "rename", path: "top", isFolder: true }, "other")).toBe("other");
  });
});

describe("a new page's starter", () => {
  it("names a folder's index page after the folder", () => {
    expect(starter("book/first-steps/index.md")).toBe("---\nname: First steps\n---\n\n# First steps\n");
  });

  it("names the book's own index a new page", () => {
    expect(starter("book/index.md")).toContain("name: New page");
  });

  it("names any other page after its file", () => {
    expect(starter("book/a/my_page.md")).toContain("# My page");
  });
});

describe("what the tree picked", () => {
  it("drops what lies in a picked folder, and doubles", () => {
    expect(
      outermost([
        { path: "book/a", isFolder: true },
        { path: "book/a/x.md", isFolder: false },
        { path: "book/ab.md", isFolder: false },
        { path: "book/ab.md", isFolder: false },
      ]),
    ).toEqual([
      { path: "book/a", isFolder: true },
      { path: "book/ab.md", isFolder: false },
    ]);
  });
});

describe("files dropped into a page", () => {
  const none = () => false;

  it("go next to the page or Typst file", () => {
    expect(dropPath("book/a/page.md", "photo.JPG", none)).toBe("book/a/photo.jpg");
    expect(dropPath("glossary/term.md", "photo.png", none)).toBe("glossary/photo.png");
    expect(dropPath("docs/sheet.typ", "photo.png", none)).toBe("docs/photo.png");
    expect(dropPath("sheet.typ", "image.png", none)).toBe("sheet.png");
  });

  it("name a pasted screenshot after the page, or its folder for an index", () => {
    expect(dropPath("book/a/intro.md", "image.png", none)).toBe("book/a/intro.png");
    expect(dropPath("book/first-steps/index.md", "image.png", none)).toBe("book/first-steps/first-steps.png");
  });

  it("number a taken name and turn spaces into dashes", () => {
    const taken = (p: string) => p === "book/my-photo.png";
    expect(dropPath("book/index.md", "my photo.png", taken)).toBe("book/my-photo-2.png");
  });

  it("are linked relative to the page", () => {
    expect(linkTo("book/a/page.md", "book/a/photo.png")).toBe("![photo](./photo.png)");
    expect(linkTo("book/a/page.md", "public/doc.pdf")).toBe("[doc](../doc.pdf)");
    expect(linkTo("book/a/page.md", "book/b/other.md")).toBe("[other](../b/other)");
    expect(linkTo("glossary/term.md", "public/x y.png")).toBe("![x y](../x%20y.png)");
    expect(linkTo("glossary/term.md", "glossary/photo.png")).toBe("![photo](./photo.png)");
    expect(linkTo("glossary/sub/term.md", "glossary/photo.png")).toBe("![photo](../photo.png)");
    expect(linkTo("book/page.md", "snippets/s.md.hbs")).toBeNull();
  });

  it("are embedded relative to a Typst file", () => {
    expect(linkTo("docs/sheet.typ", "docs/photo.png")).toBe('#image("photo.png")');
    expect(linkTo("docs/sheet.typ", "public/logo.svg")).toBe('#image("../public/logo.svg")');
    expect(linkTo("sheet.typ", "docs/part.typ")).toBe('#include "docs/part.typ"');
    expect(linkTo("docs/a/sheet.typ", "docs/data.csv")).toBe('"../data.csv"');
  });
});
