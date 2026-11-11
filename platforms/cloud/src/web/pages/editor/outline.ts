import type { Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** One heading of a file's outline. */
export type Heading = {
  /** 1 for `#` / `=`, 2 for `##` / `==`, … */
  level: number;
  /** The heading's text, without its marks. */
  title: string;
  /** Where its line starts in the file. */
  from: number;
  /** 1-based. */
  line: number;
};

/** Which headings a file has: Markdown's (pages, snippets) or Typst's. */
export function outlineKind(path: string): "markdown" | "typst" | null {
  if (/\.(md|markdown|hbs)$/i.test(path)) return "markdown";
  if (/\.typ$/i.test(path)) return "typst";
  return null;
}

/** Markdown's inline marks, which an outline shows as plain text. */
const plain = (text: string) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, "$2")
    .trim();

/**
 * The headings of `doc`, in order. Markdown: ATX headings (`## Title`),
 * not inside fenced code or the frontmatter. Typst: `= Title` at a line's
 * start, not inside raw blocks or comments.
 */
export function parseOutline(doc: Text | string, kind: "markdown" | "typst"): Heading[] {
  const lines = typeof doc === "string" ? doc.split("\n") : null;
  const count = lines ? lines.length : (doc as Text).lines;
  const lineAt = (n: number) => (lines ? lines[n - 1]! : (doc as Text).line(n).text);
  const headings: Heading[] = [];
  /** The fence a code block was opened with, while inside one. */
  let fence: string | null = null;
  let inComment = false;
  let from = 0;
  for (let n = 1; n <= count; n++) {
    const text = lineAt(n);
    const start = from;
    from += text.length + 1;
    if (kind === "markdown") {
      // The frontmatter, from a first line of "---" to the next.
      if (n === 1 && text.trimEnd() === "---") {
        fence = "---";
        continue;
      }
      if (fence === "---") {
        if (text.trimEnd() === "---") fence = null;
        continue;
      }
      const open = /^ {0,3}(`{3,}|~{3,})/.exec(text);
      if (fence !== null) {
        if (open && open[1]![0] === fence[0] && open[1]!.length >= fence.length && text.trim() === open[1]) fence = null;
        continue;
      }
      if (open) {
        fence = open[1]!;
        continue;
      }
      const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(text);
      if (heading) headings.push({ level: heading[1]!.length, title: plain(heading[2] ?? ""), from: start, line: n });
    } else {
      if (inComment) {
        if (text.includes("*/")) inComment = false;
        continue;
      }
      const raw = /^\s*(`{3,})/.exec(text);
      if (fence !== null) {
        if (text.includes(fence)) fence = null;
        continue;
      }
      if (raw && !text.slice(text.indexOf(raw[1]!) + raw[1]!.length).includes(raw[1]!)) {
        fence = raw[1]!;
        continue;
      }
      if (/^\s*\/\*/.test(text) && !text.includes("*/")) {
        inComment = true;
        continue;
      }
      const heading = /^\s*(=+)\s+(.*?)\s*(?:<[\w:.-]+>)?\s*$/.exec(text);
      if (heading) headings.push({ level: heading[1]!.length, title: heading[2]!.replace(/\s*\/\/.*$/, ""), from: start, line: n });
    }
  }
  return headings;
}

/** The heading the cursor at `pos` is under: the last one starting at or before it. */
export function currentHeading(headings: Heading[], pos: number): number {
  let current = -1;
  for (let i = 0; i < headings.length && headings[i]!.from <= pos; i++) current = i;
  return current;
}

/**
 * Tells listeners of a view about each change of its text or selection, for
 * the outline to follow the cursor without rendering the whole editor.
 */
const listeners = new WeakMap<EditorView, Set<() => void>>();

export const watchView = EditorView.updateListener.of((update) => {
  if (!update.docChanged && !update.selectionSet) return;
  for (const listener of listeners.get(update.view) ?? []) listener();
});

export function subscribeView(view: EditorView, listener: () => void) {
  const set = listeners.get(view) ?? new Set();
  listeners.set(view, set.add(listener));
  return () => void set.delete(listener);
}
