import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

/*
 * Wrapped lines keep their indentation: the continuation of a long line
 * starts below its text, not at the left edge. The line gets a hanging
 * indent as wide as its leading whitespace (tabs count to the next tab
 * stop), and in Markdown also its list or quote marker, so a wrapped list
 * item lines up under its text.
 */

const MARKDOWN_MARKER = /^(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|(?:>[ \t]?)+)/;

/** Columns of the hanging indent of `text`. */
export function hangingColumns(text: string, tabSize: number, markdown: boolean): number {
  let columns = 0;
  let i = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") columns++;
    else if (ch === "\t") columns += tabSize - (columns % tabSize);
    else break;
  }
  // A line of nothing but whitespace has nothing to wrap.
  if (i === text.length) return 0;
  if (markdown) {
    const marker = MARKDOWN_MARKER.exec(text.slice(i));
    if (marker) columns += marker[0].replace(/\t/g, " ".repeat(tabSize)).length;
  }
  return columns;
}

const cache = new Map<number, Decoration>();
function lineDeco(columns: number) {
  let deco = cache.get(columns);
  if (!deco) {
    deco = Decoration.line({
      // .cm-line has 6px of padding on the left of its own.
      attributes: { style: `padding-left: calc(${columns}ch + 6px); text-indent: -${columns}ch` },
    });
    cache.set(columns, deco);
  }
  return deco;
}

export function hangingIndent({ markdown }: { markdown: boolean }): Extension {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const tabSize = view.state.tabSize;
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        const columns = hangingColumns(line.text, tabSize, markdown);
        if (columns > 0) builder.add(line.from, line.from, lineDeco(columns));
        pos = line.to + 1;
      }
    }
    return builder.finish();
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
