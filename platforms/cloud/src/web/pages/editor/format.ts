import { type Completion, snippet } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import i18next from "i18next";
import { blockPlace, insertHost } from "./insert";

/*
 * The formatting toolbar: headings, bold, lists, links, tables, … written as
 * the file's own syntax (Markdown or Typst), so teachers see what each looks
 * like and learn it as they go.
 */

export type Syntax = "markdown" | "typst";

export type FormatId = "heading" | "bold" | "italic" | "bullets" | "numbers" | "link" | "image" | "table" | "code";
export const FORMATS: readonly FormatId[] = ["heading", "bold", "italic", "bullets", "numbers", "link", "image", "table", "code"];

const placeholder = (key: string) => i18next.t(`editor.format.placeholder.${key}`);

/** How each looks in the syntax, for the button's tooltip ("**bold**"). */
export function example(id: FormatId, syntax: Syntax): string {
  const md = syntax === "markdown";
  switch (id) {
    case "heading":
      return md ? "## …" : "= …";
    case "bold":
      return md ? "**…**" : "*…*";
    case "italic":
      return "_…_";
    case "bullets":
      return "- …";
    case "numbers":
      return md ? "1. …" : "+ …";
    case "link":
      return md ? "[…](https://…)" : '#link("https://…")[…]';
    case "image":
      return md ? "![…](./….png)" : '#image("….png")';
    case "table":
      return md ? "| … | … |" : "#table(columns: 2, …)";
    case "code":
      return "`…`";
  }
}

/** Puts `before` and `after` around the selection, or takes them away again. */
export function toggleWrap(view: EditorView, before: string, after: string, fill: string) {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const outside = state.sliceDoc(range.from - before.length, range.from) === before && state.sliceDoc(range.to, range.to + after.length) === after;
    if (outside && !range.empty) {
      return {
        changes: [
          { from: range.from - before.length, to: range.from },
          { from: range.to, to: range.to + after.length },
        ],
        range: EditorSelection.range(range.from - before.length, range.to - before.length),
      };
    }
    const text = range.empty ? fill : state.sliceDoc(range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert: before + text + after },
      range: EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
    };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
}

/**
 * Starts each selected line with `prefix(i)` (the i-th line's), or takes it
 * away when every line has one already (a second click undoes the first);
 * `existing` finds a prefix of the kind, to replace it ("# " by "## ").
 */
export function toggleLinePrefix(view: EditorView, prefix: (i: number) => string, existing: RegExp) {
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from).number;
  const last = state.doc.lineAt(range.to).number;
  const lines = [];
  for (let n = first; n <= last; n++) lines.push(state.doc.line(n));
  const filled = lines.filter((l) => l.text.trim() !== "" || lines.length === 1);
  const all = filled.every((l, i) => l.text.startsWith(prefix(i)));
  const changes = filled.map((line, i) => {
    const found = existing.exec(line.text)?.[0] ?? "";
    return all
      ? { from: line.from, to: line.from + prefix(i).length, insert: "" }
      : { from: line.from, to: line.from + found.length, insert: prefix(i) };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
}

/** The table, as a snippet: two columns, a header and one row. */
function table(syntax: Syntax): string {
  const col = (n: number) => `${placeholder("column")} ${n}`;
  const cell = placeholder("cell");
  if (syntax === "markdown") return `| \${${col(1)}} | ${col(2)} |\n| --- | --- |\n| ${cell} | ${cell} |`;
  return `#table(\n  columns: 2,\n  [*\${${col(1)}}*], [*${col(2)}*],\n  [${cell}], [${cell}],\n)`;
}

/** Applies a format. An image asks for a picture from the computer (see InsertHost). */
export function applyFormat(view: EditorView, id: FormatId, syntax: Syntax) {
  const md = syntax === "markdown";
  switch (id) {
    case "heading": {
      // Markdown's page title is "#"; sections inside it start at "##".
      const mark = md ? "## " : "= ";
      return toggleLinePrefix(view, () => mark, md ? /^#{1,6} / : /^={1,6} /);
    }
    case "bold":
      return md ? toggleWrap(view, "**", "**", placeholder("bold")) : toggleWrap(view, "*", "*", placeholder("bold"));
    case "italic":
      return toggleWrap(view, "_", "_", placeholder("italic"));
    case "bullets":
      return toggleLinePrefix(view, () => "- ", md ? /^(?:[-*+]|\d+\.) / : /^[-+] /);
    case "numbers":
      return md
        ? toggleLinePrefix(view, (i) => `${i + 1}. `, /^(?:[-*+]|\d+\.) /)
        : toggleLinePrefix(view, () => "+ ", /^[-+] /);
    case "code":
      return toggleWrap(view, "`", "`", placeholder("code"));
    case "link": {
      const range = view.state.selection.main;
      const text = view.state.sliceDoc(range.from, range.to) || placeholder("linkText");
      const template = md ? `[${text}](\${https://})` : `#link("\${https://}")[${text}]`;
      snippet(template)(view, null, range.from, range.to);
      return view.focus();
    }
    case "image": {
      const range = view.state.selection.main;
      return view.state.facet(insertHost)?.uploadImage(view, range.from, range.to);
    }
    case "table": {
      const range = view.state.selection.main;
      const place = blockPlace(view, range.from, range.to);
      snippet(place.before + table(syntax) + place.after)(view, null, place.from, place.to);
      return view.focus();
    }
  }
}

export const formatLabel = (id: FormatId) => i18next.t(`editor.format.${id}`);

/** The formats in the "/" menu, after the elements' names. */
export function formatCompletions(syntax: Syntax): Completion[] {
  return FORMATS.filter((id) => id !== "bold" && id !== "italic" && id !== "code" && id !== "link").map((id) => ({
    label: "/" + formatLabel(id),
    displayLabel: formatLabel(id),
    detail: example(id, syntax),
    type: "keyword",
    boost: 1,
    apply: (view: EditorView, _c: Completion, from: number, to: number) => {
      // The "/…" goes; the format applies to the line it was on.
      view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from } });
      applyFormat(view, id, syntax);
    },
  }));
}
