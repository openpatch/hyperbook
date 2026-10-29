import { readFileSync } from "node:fs";
import path from "node:path";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import Typo from "typo-js";
// The module under test imports browser code paths only lazily; the check
// itself is pure. "@/" is aliased to src/web by vitest.config.ts.
import { misspellings } from "../src/web/pages/editor/spellcheck";
import { pageLanguage } from "../src/web/pages/editor/page-language";

const root = path.resolve(import.meta.dirname, "..");

/** The real dictionary, as the editor loads it in the browser. */
function english() {
  const read = (file: string) =>
    readFileSync(
      path.join(root, "node_modules", "dictionary-en", file),
      "utf8",
    );
  return new Typo("en", read("index.aff"), read("index.dic"));
}

/** The misspelled words of a page, with the book's Markdown parsing. */
function wrong(page: string, words: ReadonlySet<string> = new Set()) {
  const state = EditorState.create({
    doc: page,
    // The editor's full page language, as the editor builds it.
    extensions: [
      pageLanguage({
        files: () => [],
        path: () => "book/index.md",
        onPageSettings: () => {},
      }),
    ],
  });
  return misspellings(state, english(), words, new Map()).map(({ from, to }) =>
    page.slice(from, to),
  );
}

describe("spell check", () => {
  it("underlines plain misspellings, in prose and headings", () => {
    expect(wrong("# A headng\n\nThis senctence has two errors.")).toEqual([
      "headng",
      "senctence",
    ]);
  });

  it("knows correct English, German compounds excluded by dictionary", () => {
    expect(wrong("The sentence is correct.")).toEqual([]);
  });

  it("respects Hyperbook's syntax: code, frontmatter, directives", () => {
    const page = [
      "---",
      "title: Tyop in the frontmatter",
      "---",
      "",
      "# A page abuot code",
      "",
      "```js",
      "const wrng = 'wrng';",
      "```",
      "",
      "Inline `coode` is not prose.",
      "",
      '::pyide{mode="edit"}',
      "```",
      "wrng",
      "```",
      ":::",
      "",
      '::h5p{src="/x.h5p"}',
      "",
      "A {{placeeholder}} in prose.",
      "[A lnk](https://exaple.com) keeps its text checked, not its URL.",
    ].join("\n");
    expect(wrong(page)).toEqual(["abuot", "lnk"]);
  });

  it("skips words that look like code", () => {
    expect(wrong("Use UTF8, camelCaseIdentifiers and x2y.")).toEqual([]);
  });

  it("accepts the book's own words", () => {
    expect(wrong("Struktolab helps teach.", new Set(["struktolab"]))).toEqual(
      [],
    );
    expect(wrong("Struktolab helps teach.")).toEqual(["Struktolab"]);
  });
});
