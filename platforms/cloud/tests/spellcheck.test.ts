import { readFileSync } from "node:fs";
import path from "node:path";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { loadModule } from "hunspell-asm";
// The module under test imports browser code paths only lazily; the check
// itself is pure. "@/" is aliased to src/web by vitest.config.ts.
import {
  hunspellSpeller,
  misspellings,
  type Speller,
} from "../src/web/pages/editor/spellcheck";
import { pageLanguage } from "../src/web/pages/editor/page-language";

const root = path.resolve(import.meta.dirname, "..");

const hunspell = await loadModule();
const spellers = new Map<string, Speller>();

/** The real dictionary and Hunspell, as the editor loads them in the browser. */
function speller(language: "en" | "de") {
  let found = spellers.get(language);
  if (!found) {
    const mount = (file: string) =>
      hunspell.mountBuffer(
        readFileSync(path.join(root, "node_modules", `dictionary-${language}`, file)),
        `${language}-${file}`,
      );
    found = hunspellSpeller(hunspell.create(mount("index.aff"), mount("index.dic")));
    spellers.set(language, found);
  }
  return found;
}

/** The misspelled words of a page, with the book's Markdown parsing. */
function wrong(
  page: string,
  words: ReadonlySet<string> = new Set(),
  language: "en" | "de" = "en",
) {
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
  return misspellings(state, speller(language), words, new Map()).map(({ from, to }) =>
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

  it("knows correct English", () => {
    expect(wrong("The sentence is correct.")).toEqual([]);
  });

  it("knows German compounds the dictionary builds from parts", () => {
    expect(
      wrong("Ein Fehlversuch ist kein Grenzfall, Grenzfälle schon.", new Set(), "de"),
    ).toEqual([]);
    expect(wrong("Ein Fehlversuh.", new Set(), "de")).toEqual(["Fehlversuh"]);
  });

  it("suggests whole words, not word parts", () => {
    expect(speller("de").suggest("Fehlversuh")).toContain("Fehlversuch");
    expect(speller("de").suggest("Hausx").some((s) => s.endsWith("-"))).toBe(false);
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
