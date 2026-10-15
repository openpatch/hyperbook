/**
 * Indentation guides: thin vertical lines in the leading whitespace that show
 * which block a line belongs to, so learners can see where the body of an
 * `if`, a loop or a function ends.
 *
 * The guides follow the document's own block structure instead of a fixed
 * indent unit: a line gets a guide at the indentation column of every line
 * that encloses it. Code indented with two spaces, four spaces or tabs all
 * lines up the same way.
 *
 * The guide of the block around the cursor is drawn stronger. On a line that
 * opens a block (`for i in range(3):`), that is the block it opens.
 */
import { countColumn } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

/**
 * @typedef {object} IndentStructure
 * @property {number[]} indents
 *   Indentation column of each line, or -1 for a blank line.
 * @property {number[][]} guides
 *   Columns (ascending) that get a guide on each line.
 */

/**
 * @param {string[]} lines
 * @param {number} tabSize
 * @returns {IndentStructure}
 */
export function computeIndentGuides(lines, tabSize) {
  const indents = new Array(lines.length);
  const guides = new Array(lines.length);
  /** Indentation columns of the lines enclosing the current one. */
  const stack = [];
  let blankFrom = -1;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const firstChar = text.search(/\S/);
    if (firstChar < 0) {
      indents[i] = -1;
      if (blankFrom < 0) blankFrom = i;
      continue;
    }
    const indent = countColumn(text, tabSize, firstChar);
    while (stack.length && stack[stack.length - 1] >= indent) stack.pop();
    const columns = stack.slice();
    indents[i] = indent;
    guides[i] = columns;
    // Blank lines take the guides of the next line with content, so a block
    // keeps its guide across empty lines but does not run past its end.
    if (blankFrom >= 0) {
      for (let b = blankFrom; b < i; b++) guides[b] = columns;
      blankFrom = -1;
    }
    stack.push(indent);
  }
  if (blankFrom >= 0) {
    for (let b = blankFrom; b < lines.length; b++) guides[b] = [];
  }
  return { indents, guides };
}

/**
 * Find the guide to highlight for the cursor on line `lineIndex` (0-based).
 *
 * @param {IndentStructure} structure
 * @param {number} lineIndex
 * @returns {{ column: number, from: number, to: number } | null}
 *   The guide's column and the first and last line (0-based) it spans.
 */
export function activeIndentGuide({ indents, guides }, lineIndex) {
  const indent = indents[lineIndex];
  let anchor = lineIndex;
  let column;
  if (indent >= 0 && guides[lineIndex + 1]?.includes(indent)) {
    anchor = lineIndex + 1;
    column = indent;
  } else {
    const columns = guides[lineIndex];
    if (!columns?.length) return null;
    column = columns[columns.length - 1];
  }
  let from = anchor;
  let to = anchor;
  while (from > 0 && guides[from - 1].includes(column)) from--;
  while (to < guides.length - 1 && guides[to + 1].includes(column)) to++;
  return { column, from, to };
}

const GUIDE = "var(--hb-indent-guide)";
const GUIDE_ACTIVE = "var(--hb-indent-guide-active)";

/** @type {Map<string, Decoration>} */
const decorationCache = new Map();

/**
 * One background layer per guide. Everything is inline so that a theme's
 * `background` shorthand on `.cm-activeLine` cannot reset the size or origin.
 *
 * @param {number[]} columns
 * @param {number} active Column of the highlighted guide, or -1.
 */
function guideDecoration(columns, active) {
  const key = `${columns.join(",")}|${active}`;
  let deco = decorationCache.get(key);
  if (!deco) {
    const images = columns.map((col) => {
      const color = col === active ? GUIDE_ACTIVE : GUIDE;
      return `linear-gradient(${color}, ${color})`;
    });
    const positions = columns.map((col) => `${col}ch 0`);
    deco = Decoration.line({
      attributes: {
        style:
          `background-image: ${images.join(", ")};` +
          `background-position: ${positions.join(", ")};` +
          "background-size: 1px 100%;" +
          "background-repeat: no-repeat;" +
          "background-origin: content-box;",
      },
    });
    decorationCache.set(key, deco);
  }
  return deco;
}

const indentGuidesPlugin = ViewPlugin.fromClass(
  class {
    /** @param {EditorView} view */
    constructor(view) {
      this.structure = this.measure(view);
      this.decorations = this.build(view);
    }

    /** @param {import("@codemirror/view").ViewUpdate} update */
    update(update) {
      if (update.docChanged) this.structure = this.measure(update.view);
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.build(update.view);
      }
    }

    /** @param {EditorView} view */
    measure(view) {
      const lines = [];
      for (const text of view.state.doc.iterLines()) lines.push(text);
      return computeIndentGuides(lines, view.state.tabSize);
    }

    /** @param {EditorView} view */
    build(view) {
      const { doc, selection } = view.state;
      const cursorLine = doc.lineAt(selection.main.head).number - 1;
      const active = activeIndentGuide(this.structure, cursorLine);
      const ranges = [];
      let done = 0;
      for (const { from, to } of view.visibleRanges) {
        const last = doc.lineAt(to).number;
        // Neighbouring ranges around a fold can share a line.
        for (
          let n = Math.max(doc.lineAt(from).number, done + 1);
          n <= last;
          n++
        ) {
          const columns = this.structure.guides[n - 1];
          if (!columns.length) continue;
          const highlighted =
            active && n - 1 >= active.from && n - 1 <= active.to
              ? active.column
              : -1;
          ranges.push(
            guideDecoration(columns, highlighted).range(doc.line(n).from),
          );
        }
        done = Math.max(done, last);
      }
      return Decoration.set(ranges);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const indentGuidesTheme = EditorView.baseTheme({
  "&light": {
    "--hb-indent-guide": "#d0d7de",
    "--hb-indent-guide-active": "#8c959f",
  },
  "&dark": {
    "--hb-indent-guide": "#30363d",
    "--hb-indent-guide-active": "#6e7681",
  },
});

export function indentGuides() {
  return [indentGuidesPlugin, indentGuidesTheme];
}
