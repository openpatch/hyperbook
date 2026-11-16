import { EditorSelection, EditorState, type Extension, Text, Transaction, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import i18next from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { en } from "../src/shared/i18n/locales/en";
import { type ExplainRequest, excerptAt, explainWithAi, withExplain } from "../src/web/pages/editor/ai-explain";
import { applyFormat } from "../src/web/pages/editor/format";
import { INSERT_ITEMS, type InsertHost, insertHost, insertItem, itemSnippet } from "../src/web/pages/editor/insert";
import { DIRECTIVES } from "../src/web/pages/editor/directives";

beforeAll(async () => {
  await i18next.init({ lng: "en", resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
});

/**
 * Enough of an EditorView for the toolbar's commands: its state, which each
 * dispatch moves on. `|` marks the cursor, `[` and `]` a selection.
 */
function fakeView(marked: string, extensions: Extension[] = []) {
  const cursor = marked.indexOf("|");
  const from = cursor >= 0 ? cursor : marked.indexOf("[");
  const doc = marked.replace(/[|[\]]/g, "");
  const to = cursor >= 0 ? cursor : marked.indexOf("]") - 1;
  const view = {
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(from, to),
      extensions,
    }),
    dispatch(...specs: (Transaction | TransactionSpec)[]) {
      const [first] = specs;
      view.state = first instanceof Transaction ? first.state : view.state.update(...(specs as TransactionSpec[])).state;
    },
    focus() {},
  };
  return view as typeof view & EditorView;
}

/** The text with the selection marked as fakeView reads it. */
function marked(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc.toString();
  if (from === to) return doc.slice(0, from) + "|" + doc.slice(from);
  return doc.slice(0, from) + "[" + doc.slice(from, to) + "]" + doc.slice(to);
}

describe("the formatting toolbar", () => {
  it("makes the selection bold, and plain again on a second click", () => {
    const view = fakeView("a [word] here");
    applyFormat(view, "bold", "markdown");
    expect(marked(view)).toBe("a **[word]** here");
    applyFormat(view, "bold", "markdown");
    expect(marked(view)).toBe("a [word] here");
  });

  it("writes Typst's own syntax in a Typst file", () => {
    const view = fakeView("a [word]");
    applyFormat(view, "bold", "typst");
    expect(view.state.doc.toString()).toBe("a *word*");
  });

  it("puts a placeholder in, selected, where nothing is selected", () => {
    const view = fakeView("x |");
    applyFormat(view, "italic", "markdown");
    expect(marked(view)).toBe("x _[italic text]_");
  });

  it("turns lines into a list, and back", () => {
    const view = fakeView("[one\ntwo]");
    applyFormat(view, "numbers", "markdown");
    expect(view.state.doc.toString()).toBe("1. one\n2. two");
    applyFormat(view, "bullets", "markdown");
    expect(view.state.doc.toString()).toBe("- one\n- two");
    applyFormat(view, "bullets", "markdown");
    expect(view.state.doc.toString()).toBe("one\ntwo");
  });

  it("makes a heading of the line, replacing another level", () => {
    const view = fakeView("# Ti|tle");
    applyFormat(view, "heading", "markdown");
    expect(view.state.doc.toString()).toBe("## Title");
    const typst = fakeView("Ti|tle");
    applyFormat(typst, "heading", "typst");
    expect(typst.state.doc.toString()).toBe("= Title");
  });

  it("links the selected text", () => {
    const view = fakeView("see [the docs]");
    applyFormat(view, "link", "markdown");
    expect(view.state.doc.toString()).toBe("see [the docs](https://)");
    const typst = fakeView("see [the docs]");
    applyFormat(typst, "link", "typst");
    expect(typst.state.doc.toString()).toBe('see #link("https://")[the docs]');
  });

  it("puts a table on lines of its own", () => {
    const view = fakeView("Text|\nmore");
    applyFormat(view, "table", "markdown");
    expect(view.state.doc.toString()).toBe(
      "Text\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n\nmore",
    );
  });
});

describe("inserting elements", () => {
  const item = (id: string) => INSERT_ITEMS.find((i) => i.id === id)!;

  it("names only elements that exist", () => {
    const names = new Set(DIRECTIVES.map((d) => d.name));
    for (const i of INSERT_ITEMS) expect(names.has(i.directive), i.id).toBe(true);
  });

  it("has a name and a description for each, in every group", () => {
    for (const i of INSERT_ITEMS) {
      for (const part of ["label", "description"]) {
        const key = `editor.insert.items.${i.id}.${part}`;
        expect(i18next.t(key), key).not.toBe(key);
      }
    }
  });

  it("writes an element on lines of its own, a blank line from the text", () => {
    const view = fakeView("Some text|");
    insertItem(view, item("hint"), view.state.selection.main.from, view.state.selection.main.to);
    expect(view.state.doc.toString()).toBe('Some text\n\n:::collapsible{title="Hint"}\nText\n:::');
  });

  it("replaces the '/…' it was picked with", () => {
    const view = fakeView("/qu|");
    insertItem(view, item("quiz"), 0, 3);
    expect(view.state.doc.toString()).toBe(
      ":::multievent\nThe capital of France is {t{Paris}}.\n\nWhich numbers are prime?\n{c{!2}}   {c{!3}}   {c{4}}   {c{!5}}\n:::",
    );
  });

  it("makes an element's file and points the element at it, relative to the page", () => {
    const made: string[] = [];
    const host: InsertHost = {
      uploadImage: () => {},
      createFile: (_v, i) => {
        made.push(i.file!.name);
        return `./${i.file!.name}`;
      },
      editBlock: () => {},
    };
    const view = fakeView("|", [insertHost.of(host)]);
    insertItem(view, item("drawing"), 0, 0);
    expect(made).toEqual(["drawing.excalidraw"]);
    expect(view.state.doc.toString()).toBe('::excalidraw{src="./drawing.excalidraw"}');
    expect(itemSnippet(item("taskFlow"), "./quiz.bitflow")).toBe('::bitflow{src="./quiz.bitflow" height="600px"}');
  });

  it("opens a structogram in its visual editor once written", () => {
    const opened: string[] = [];
    const host: InsertHost = { uploadImage: () => {}, createFile: () => null, editBlock: (b) => opened.push(b.type) };
    const view = fakeView("|", [insertHost.of(host)]);
    insertItem(view, item("structogram"), 0, 0);
    expect(opened).toEqual(["inline"]);
  });

  it("asks for an image to upload in place of the '/…'", () => {
    const asked: [number, number][] = [];
    const host: InsertHost = { uploadImage: (_v, f, t) => asked.push([f, t]), createFile: () => null, editBlock: () => {} };
    const view = fakeView("a\n/im|", [insertHost.of(host)]);
    insertItem(view, item("image"), 2, 5);
    expect(view.state.doc.toString()).toBe("a\n");
    expect(asked).toEqual([[2, 2]]);
  });
});

describe("Explain with AI", () => {
  it("quotes the lines around the error, numbered, the error's marked", () => {
    const doc = Text.of(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    const { line, excerpt } = excerptAt(doc, doc.line(5).from);
    expect(line).toBe(5);
    expect(excerpt.split("\n")).toEqual(["  2 | 2", "  3 | 3", "  4 | 4", "> 5 | 5", "  6 | 6", "  7 | 7", "  8 | 8"]);
  });

  it("adds its button to errors only where the AI answers", () => {
    const error = { from: 0, to: 1, severity: "error" as const, message: "Unknown" };
    const without = fakeView("x|");
    expect(withExplain(without, [error])[0]!.actions).toBeUndefined();

    const asked: ExplainRequest[] = [];
    const view = fakeView("x|", [explainWithAi.of((r) => asked.push(r))]);
    const [marked] = withExplain(view, [error, { ...error, severity: "info" }]);
    expect(marked!.actions?.map((a) => a.name)).toEqual(["Explain with AI"]);
    marked!.actions![0]!.apply(view, 0, 1);
    expect(asked).toEqual([{ message: "Unknown", line: 1, excerpt: "> 1 | x" }]);
  });
});
