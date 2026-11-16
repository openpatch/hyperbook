/*
 * Between a Typst file and its PDF, both ways. Typst writes no source map
 * like LaTeX's SyncTeX, so words are looked for among words:
 *
 * - From the PDF to the source (a double-clicked line): the line's words
 *   among the source's words.
 * - From the source to the PDF (the cursor): the words around the cursor
 *   among the PDF's words.
 *
 * Either way:
 *
 * - The longest run of the words in a row wins. Small gaps are allowed on
 *   both sides: markup between words in the source, a word the PDF
 *   hyphenated. The run may cross lines.
 * - A word the PDF hyphenated at the end of a line is joined again.
 * - Equal runs (a phrase that occurs more than once) are told apart by the
 *   words around them, then by how far down the document they are.
 * - The result is the word the match aligned with the clicked one (or the
 *   one at the cursor), not the first place that word occurs.
 *
 * Names of Typst functions (`#emph`, `#set text`) are not text of the PDF,
 * so they are no words of the source.
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

/** A line of the PDF found for the cursor: its page and its index there (0-based). */
export type PdfPlace = { page: number; line: number };

const WORD = /[\p{L}\p{N}]+/gu;

/** The words of Typst source, without the names of functions. */
export function wordsOf(text: string): Word[] {
  const out: Word[] = [];
  for (const match of text.matchAll(WORD)) {
    // `#emph[…]`, `#set page(…)`: a function call, not text.
    if (text[match.index - 1] === "#") continue;
    out.push({ text: match[0].toLowerCase(), at: match.index });
  }
  return out;
}

/** The words of PDF text: all of them. */
const plainWords = (text: string) => [...text.matchAll(WORD)].map((m) => m[0].toLowerCase());

/** A line that ends in a word broken by hyphenation ("conser-"). */
const HYPHENATED = /\p{L}[-­‐]$/u;
/** A line that starts with the rest of such a word ("vation"). */
const CONTINUED = /^\p{Ll}/u;

/** Gaps a run may have in all, in the haystack and in the wanted words together. */
const MAX_SKIPS = 3;

/**
 * The run of `wanted` from its word `j` along `hay` from its word `i`:
 * how many words matched, where the run ends in the haystack, and which
 * haystack word each matched wanted word is.
 */
function run(hay: Word[], i: number, wanted: string[], j: number) {
  const aligned = new Map<number, number>();
  let count = 0;
  let skips = 0;
  let end = i;
  while (i < hay.length && j < wanted.length) {
    if (hay[i]!.text === wanted[j]) {
      aligned.set(j, i);
      count++;
      end = i;
      i++;
      j++;
    } else if (skips < MAX_SKIPS && hay[i + 1]?.text === wanted[j]) {
      skips++;
      i++;
    } else if (skips < MAX_SKIPS && hay[i]!.text === wanted[j + 1]) {
      skips++;
      j++;
    } else {
      break;
    }
  }
  return { count, end, aligned };
}

/** How many of `context`'s words occur among `hay` words from..to. */
function overlap(hay: Word[], from: number, to: number, context: string[]) {
  if (context.length === 0) return 0;
  const near = new Set(hay.slice(Math.max(0, from), Math.max(0, to)).map((w) => w.text));
  return context.filter((w) => near.has(w)).length;
}

/**
 * The haystack word that `wanted[target]` is, by the best run of `wanted`
 * in `hay`; when the run leaves the target out, its aligned word nearest to
 * it. Null when no run has at least two words (or all of a shorter `wanted`).
 *
 * With `cover`, a run that reaches over the target beats a longer one beside
 * it: the words around the cursor say where it is, a long run further away
 * does not.
 */
function align(
  hay: Word[],
  wanted: string[],
  target: number,
  options: { before?: string[]; after?: string[]; expected?: number | null; cover?: boolean } = {},
): number | null {
  if (wanted.length === 0 || hay.length === 0) return null;
  const needed = Math.min(2, wanted.length);
  const before = options.before ?? [];
  const after = options.after ?? [];
  const expected = options.expected ?? null;

  type Best = { covers: boolean; count: number; context: number; distance: number; start: number; aligned: Map<number, number> };
  let best: Best | null = null;
  for (let i = 0; i < hay.length; i++) {
    for (let j = 0; j < wanted.length; j++) {
      if (hay[i]!.text !== wanted[j]) continue;
      // Only where a run starts: inside a run it would be shorter.
      if (j > 0 && i > 0 && hay[i - 1]!.text === wanted[j - 1]) continue;
      const { count, end, aligned } = run(hay, i, wanted, j);
      if (count < needed) continue;
      const js = [...aligned.keys()];
      const covers = !!options.cover && js[0]! <= target && target <= js.at(-1)!;
      const context =
        overlap(hay, i - before.length - 4, i, before) + overlap(hay, end + 1, end + 1 + after.length + 4, after);
      const distance = expected === null ? 0 : Math.abs(hay[i]!.at - expected);
      const candidate = { covers, count, context, distance, start: i, aligned };
      if (!best || better(candidate, best)) best = candidate;
    }
  }
  if (!best) return null;
  const exact = best.aligned.get(target);
  if (exact !== undefined) return exact;
  let nearest = best.start;
  let gap = Infinity;
  for (const [j, i] of best.aligned) {
    if (Math.abs(j - target) < gap) {
      gap = Math.abs(j - target);
      nearest = i;
    }
  }
  return nearest;

  function better(a: Best, b: Best) {
    if (a.covers !== b.covers) return a.covers;
    if (a.count !== b.count) return a.count > b.count;
    if (a.context !== b.context) return a.context > b.context;
    return a.distance < b.distance;
  }
}

/**
 * The source offset of a clicked PDF line: at the clicked word when the
 * match covers it, else the matched word nearest to it. Null when nothing
 * in the source fits well enough.
 */
export function findInSource(source: string, click: PdfClick): number | null {
  const wanted = plainWords(click.line);
  if (wanted.length === 0) return null;
  // A word hyphenated across lines is whole in the source.
  const after = plainWords(click.after ?? "");
  if (HYPHENATED.test(click.line.trimEnd()) && CONTINUED.test((click.after ?? "").trimStart()) && after.length > 0) {
    wanted[wanted.length - 1] += after.shift()!;
  }
  const before = plainWords(click.before ?? "");
  if (HYPHENATED.test((click.before ?? "").trimEnd()) && CONTINUED.test(click.line.trimStart()) && before.length > 0) {
    wanted[0] = before.pop()! + wanted[0];
  }
  const all = wordsOf(source);
  const at = align(all, wanted, click.wordIndex, {
    before,
    after,
    expected: click.fraction === undefined ? null : click.fraction * source.length,
  });
  return at === null ? null : all[at]!.at;
}

/** How many words around the cursor's line are looked for, on either side. */
const AROUND = 6;

/**
 * The line of the PDF that shows the text at `offset` of `source`. `pages`
 * holds each page's lines of text, top to bottom. Null when the text near
 * the cursor is not in the PDF (code, a comment, a part not compiled).
 */
export function findInPdf(source: string, offset: number, pages: string[][]): PdfPlace | null {
  // The PDF's words, each knowing its line; hyphenated words joined.
  const hay: Word[] = [];
  const places: PdfPlace[] = [];
  let joinNext = false;
  for (let page = 0; page < pages.length; page++) {
    const lines = pages[page]!;
    for (let line = 0; line < lines.length; line++) {
      const text = lines[line]!;
      const words = plainWords(text);
      if (joinNext && words.length > 0 && CONTINUED.test(text.trimStart())) {
        hay.at(-1)!.text += words.shift()!;
      }
      for (const word of words) {
        hay.push({ text: word, at: hay.length });
        places.push({ page, line });
      }
      joinNext = HYPHENATED.test(text.trimEnd()) && words.length > 0;
    }
  }
  if (hay.length === 0) return null;

  // The words of the cursor's line, and some on either side of it.
  const all = wordsOf(source);
  if (all.length === 0) return null;
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = source.indexOf("\n", offset);
  const lineTo = lineEnd < 0 ? source.length : lineEnd;
  let first = all.findIndex((w) => w.at >= lineStart);
  if (first < 0) first = all.length;
  let last = first;
  while (last < all.length && all[last]!.at < lineTo) last++;
  // The word at the cursor, or the next one on its line, or the one before it.
  let target = all.findIndex((w, i) => i >= first && i < last && w.at + w.text.length >= offset);
  if (target < 0) target = last > first ? last - 1 : Math.min(first, all.length - 1);
  const from = Math.max(0, Math.min(first, target) - AROUND);
  const to = Math.min(all.length, Math.max(last, target + 1) + AROUND);
  const wanted = all.slice(from, to).map((w) => w.text);

  const at = align(hay, wanted, target - from, {
    expected: (offset / Math.max(1, source.length)) * hay.length,
    cover: true,
  });
  return at === null ? null : places[at]!;
}
