import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { currentHeading, outlineKind, parseOutline } from "../src/web/pages/editor/outline";

const titles = (text: string, kind: "markdown" | "typst") =>
  parseOutline(text, kind).map((h) => [h.level, h.title, h.line]);

describe("outline", () => {
  it("knows which files have one", () => {
    expect(outlineKind("book/index.md")).toBe("markdown");
    expect(outlineKind("snippets/x.md.hbs")).toBe("markdown");
    expect(outlineKind("doc/sheet.typ")).toBe("typst");
    expect(outlineKind("hyperbook.json")).toBeNull();
  });

  it("lists Markdown headings, but not in the frontmatter or code", () => {
    const text = [
      "---",
      "name: Page",
      "# not a heading",
      "---",
      "# Waves",
      "Text #notaheading",
      "## The **wave** [equation](/eq) ##",
      "```python",
      "# a comment",
      "~~~",
      "```",
      "#### Deep",
      "#Tag",
      ":::alert{info}",
      "### Inside a directive",
      ":::",
    ].join("\n");
    expect(titles(text, "markdown")).toEqual([
      [1, "Waves", 5],
      [2, "The wave equation", 7],
      [4, "Deep", 12],
      [3, "Inside a directive", 15],
    ]);
  });

  it("lists Typst headings, but not in raw blocks or comments", () => {
    const text = [
      "#set page(width: 10cm)",
      "= Intro <intro>",
      "Text with = sign",
      "```",
      "= raw",
      "```",
      "/*",
      "= commented",
      "*/",
      "== Details // later",
    ].join("\n");
    expect(titles(text, "typst")).toEqual([
      [1, "Intro", 2],
      [2, "Details", 10],
    ]);
  });

  it("gives offsets, from a string or the editor's text", () => {
    const text = "intro\n# One\nbody\n## Two\n";
    const fromString = parseOutline(text, "markdown");
    expect(fromString.map((h) => h.from)).toEqual([6, 17]);
    expect(parseOutline(Text.of(text.split("\n")), "markdown")).toEqual(fromString);
    expect(currentHeading(fromString, 0)).toBe(-1);
    expect(currentHeading(fromString, 10)).toBe(0);
    expect(currentHeading(fromString, 17)).toBe(1);
  });
});
