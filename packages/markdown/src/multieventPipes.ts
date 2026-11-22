import type { Root } from "mdast";

/**
 * Multievent markers use the pipe as their option separator: `{a{cat|!dog}}`
 * lists the dropdown's options. Markdown tables use the same pipe to separate
 * their cells, so a marker written into a table cell is torn apart by the
 * parser: `{a{cat` becomes one cell and every option another.
 *
 * The fix runs as part of parsing (see remarkParse): inside a `:::multievent`
 * block, every pipe of a marker that opens and closes on the same line is
 * swapped for `PIPE_STANDIN` before micromark sees the source, and swapped
 * back in the parsed tree right after. The stand-in is one UTF-16 code unit
 * like the pipe, so every offset in the tree stays the offset of the page's
 * own source; and like the pipe it is a Unicode symbol, so emphasis next to
 * it parses the same. Outside a table the tree is therefore exactly the one
 * the page had before, so the ids readers' work is saved under do not move.
 *
 * Markers that span several lines — the `{w{…~~…}}` word searches and the
 * `{W{…}}` crossword grids, whose pipes build their own grid — keep their
 * pipes: they cannot sit in a table row anyway. Fenced code is left alone.
 */
export const PIPE_STANDIN = "⦀";

const OPEN_CONTAINER = /^ {0,3}:{3,}([a-zA-Z][a-zA-Z0-9-]*)(?:[ \t{[}]|$)/;
const CLOSE_CONTAINER = /^ {0,3}:{3,}[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const MARKER_OPEN = /\{([a-zA-Z])\d*\{/g;

/**
 * Where the `}}` closing a marker starts, scanning `value` from `from` (just
 * after the marker's opening `{x{`), or -1. Braces nest: a nested marker
 * `{h{see {t{x}}}}` or LaTeX `{m{\sqrt{2}}}` closes at its own `}}`, not at the
 * first one. A backslash keeps the next character from counting.
 *
 * `depth` carries the nesting across pieces of text, for markers that run
 * over several text nodes; pass the same object for each piece.
 */
export function markerCloseIndex(
  value: string,
  from = 0,
  state: { depth: number } = { depth: 0 },
): number {
  for (let i = from; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === "{") {
      state.depth++;
    } else if (char === "}") {
      if (state.depth === 0) {
        if (value[i + 1] === "}") return i;
      } else {
        state.depth--;
      }
    }
  }
  return -1;
}

/** Swap one line's marker pipes, carrying an unclosed marker across lines. */
function protectLine(line: string, unclosed: { open: boolean }): string {
  let result = "";
  let cursor = 0;

  while (cursor < line.length) {
    if (unclosed.open) {
      // Continuation of a marker that opened on an earlier line: a word
      // search or crossword grid, whose pipes are part of its own layout.
      const close = line.indexOf("}}", cursor);
      if (close === -1) return result + line.slice(cursor);
      result += line.slice(cursor, close + 2);
      unclosed.open = false;
      cursor = close + 2;
      continue;
    }

    MARKER_OPEN.lastIndex = cursor;
    const opened = MARKER_OPEN.exec(line);
    if (!opened || (opened.index > 0 && line[opened.index - 1] === "\\")) {
      if (!opened) return result + line.slice(cursor);
      result += line.slice(cursor, opened.index + 1);
      cursor = opened.index + 1;
      continue;
    }

    result += line.slice(cursor, opened.index + opened[0].length);
    cursor = opened.index + opened[0].length;

    const close = markerCloseIndex(line, cursor);
    if (close === -1) {
      // The marker runs over several lines: hand the rest of the line and
      // the following ones to the grid branch above, unchanged.
      unclosed.open = true;
      return result + line.slice(cursor);
    }

    for (let i = cursor; i < close; i++) {
      result +=
        line[i] === "|" && line[i - 1] !== "\\" ? PIPE_STANDIN : line[i];
    }
    result += "}}";
    cursor = close + 2;
  }

  return result;
}

/**
 * The page's source with the marker pipes of its multievent blocks swapped
 * for `PIPE_STANDIN`. Same length as `markdown`, character for character.
 *
 * Lines outside a `:::multievent` block (or a block nested in one) are left
 * untouched, so tables elsewhere keep plain markdown semantics.
 */
export function protectMultieventPipes(markdown: string): string {
  if (!markdown.includes("multievent")) return markdown;
  const lines = markdown.split("\n");
  const containers: string[] = [];
  let fence: string | null = null;
  const unclosed = { open: false };

  return lines
    .map((line) => {
      const fenceMatch = FENCE.exec(line);
      if (fence !== null) {
        if (
          fenceMatch &&
          fenceMatch[1][0] === fence[0] &&
          fenceMatch[1].length >= fence.length &&
          line.trim() === fenceMatch[1]
        ) {
          fence = null;
        }
        return line;
      }
      if (fenceMatch) {
        fence = fenceMatch[1];
        unclosed.open = false;
        return line;
      }

      const name = OPEN_CONTAINER.exec(line)?.[1];
      if (name) {
        containers.push(name);
        unclosed.open = false;
        return line;
      }
      if (CLOSE_CONTAINER.test(line)) {
        containers.pop();
        unclosed.open = false;
        return line;
      }

      if (!containers.includes("multievent")) return line;
      return protectLine(line, unclosed);
    })
    .join("\n");
}

const STANDIN_PATTERN = new RegExp(PIPE_STANDIN, "g");

/**
 * Puts the pipes back into the values of a tree parsed from protected source.
 * Stand-ins only ever come from inside multievent blocks, so only those are
 * touched: a `⦀` an author wrote anywhere else stays one.
 */
export function restoreMultieventPipes(tree: Root): void {
  const walk = (node: any, inside: boolean) => {
    const within =
      inside ||
      (node.type === "containerDirective" && node.name === "multievent");
    if (
      within &&
      typeof node.value === "string" &&
      node.value.includes(PIPE_STANDIN)
    ) {
      node.value = node.value.replace(STANDIN_PATTERN, "|");
    }
    if (Array.isArray(node.children))
      node.children.forEach((child: any) => walk(child, within));
    // remark-math copies a formula into the hast it will become while parsing
    if (Array.isArray(node.data?.hChildren))
      node.data.hChildren.forEach((child: any) => walk(child, within));
  };
  walk(tree, false);
}
