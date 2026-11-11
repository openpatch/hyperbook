/*
 * From a double-clicked line of a Typst file's PDF back to its source.
 * Typst writes no source map like LaTeX's SyncTeX, so the line's words are
 * looked for in the source's words:
 *
 * - The longest run of the line's words in a row wins. Small gaps are
 *   allowed on both sides: markup between words in the source, a word the
 *   PDF hyphenated. The run may cross source lines.
 * - Equal runs (a phrase that occurs more than once) are told apart by the
 *   PDF lines above and below the clicked one, then by how far down the
 *   document the click was.
 * - The cursor goes to the clicked word as the match aligned it, not to
 *   the first place that word occurs.
 *
 * Names of Typst functions (`#emph`, `#set text`) are not text of the PDF,
 * so they are no words here.
 */

type Word = { text: string; at: number };

export type PdfClick = {
  /** The clicked line's text. */
  line: string;
  /** Which of the line's words was clicked (0-based); -1 if none. */
  wordIndex: number;
  /** The lines above and below on the page, "" at its edges. */
  before?: string;
  after?: string;
  /** How far down the document the click was, 0 to 1. */
  fraction?: number;
};

const WORD = /[\p{L}\p{N}]+/gu;

export function wordsOf(text: string): Word[] {
  const out: Word[] = [];
  for (const match of text.matchAll(WORD)) {
    // `#emph[…]`, `#set page(…)`: a function call, not text.
    if (text[match.index - 1] === "#") continue;
    out.push({ text: match[0].toLowerCase(), at: match.index });
  }
  return out;
}

const words = (text: string) => wordsOf(text).map((w) => w.text);

/** Gaps a run may have in all, in the source and in the PDF line together. */
const MAX_SKIPS = 3;

/**
 * The run of `wanted` from its word `j` along `source` from its word `i`:
 * how many words matched, where the run ends in the source, and which
 * source word each matched wanted word is.
 */
function run(source: Word[], i: number, wanted: string[], j: number) {
  const aligned = new Map<number, number>();
  let count = 0;
  let skips = 0;
  let end = i;
  while (i < source.length && j < wanted.length) {
    if (source[i]!.text === wanted[j]) {
      aligned.set(j, i);
      count++;
      end = i;
      i++;
      j++;
    } else if (skips < MAX_SKIPS && source[i + 1]?.text === wanted[j]) {
      skips++;
      i++;
    } else if (skips < MAX_SKIPS && source[i]!.text === wanted[j + 1]) {
      skips++;
      j++;
    } else {
      break;
    }
  }
  return { count, end, aligned };
}

/** How many of `context`'s words occur among `source` words from..to. */
function overlap(source: Word[], from: number, to: number, context: string[]) {
  if (context.length === 0) return 0;
  const near = new Set(source.slice(Math.max(0, from), Math.max(0, to)).map((w) => w.text));
  return context.filter((w) => near.has(w)).length;
}

/**
 * The source offset of a clicked PDF line: at the clicked word when the
 * match covers it, else where the match starts. Null when nothing in the
 * source fits well enough.
 */
export function findInSource(source: string, click: PdfClick): number | null {
  const wanted = words(click.line);
  if (wanted.length === 0) return null;
  const all = wordsOf(source);
  if (all.length === 0) return null;
  const needed = Math.min(2, wanted.length);
  const before = words(click.before ?? "");
  const after = words(click.after ?? "");
  const expected = click.fraction === undefined ? null : click.fraction * source.length;

  let best: { count: number; context: number; distance: number; start: number; aligned: Map<number, number> } | null =
    null;
  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < wanted.length; j++) {
      if (all[i]!.text !== wanted[j]) continue;
      // Only where a run starts: inside a run it would be shorter.
      if (j > 0 && i > 0 && all[i - 1]!.text === wanted[j - 1]) continue;
      const { count, end, aligned } = run(all, i, wanted, j);
      if (count < needed) continue;
      const context =
        overlap(all, i - before.length - 4, i, before) + overlap(all, end + 1, end + 1 + after.length + 4, after);
      const distance = expected === null ? 0 : Math.abs(all[i]!.at - expected);
      const better =
        !best ||
        count > best.count ||
        (count === best.count && context > best.context) ||
        (count === best.count && context === best.context && distance < best.distance);
      if (better) best = { count, context, distance, start: i, aligned };
    }
  }
  if (!best) return null;
  const clicked = best.aligned.get(click.wordIndex);
  return all[clicked ?? best.start]!.at;
}
