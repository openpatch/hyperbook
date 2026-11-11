/*
 * From a double-clicked line of a Typst file's PDF back to its source.
 * Typst writes no source map like LaTeX's SyncTeX, so the line's words are
 * looked for in the source: the source line holding most of them, in their
 * order, wins, and the cursor goes to the word that was clicked. Markup
 * (`*strong*`, `#emph[…]`, `= Heading`) sits between the words and is
 * skipped, as are words the PDF hyphenated.
 */

type Word = { text: string; at: number };

function wordsOf(text: string, offset = 0): Word[] {
  const out: Word[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    out.push({ text: match[0].toLowerCase(), at: offset + match.index });
  }
  return out;
}

/** How many of `wanted` occur in `words` in their order, and where the match starts. */
function inOrder(wanted: string[], words: Word[]) {
  let i = 0;
  let first: Word | null = null;
  for (const word of words) {
    if (i < wanted.length && word.text === wanted[i]) {
      first ??= word;
      i++;
    }
  }
  return { count: i, first };
}

/**
 * The source offset of a PDF line's text: at `clicked` (a word of the line,
 * the one under the pointer) when it is there, else where the line starts.
 * Null when no source line holds enough of it.
 */
export function findInSource(source: string, lineText: string, clicked?: string): number | null {
  const wanted = wordsOf(lineText).map((w) => w.text);
  if (wanted.length === 0) return null;
  const needed = Math.min(2, wanted.length);
  let best: { count: number; words: Word[]; first: Word } | null = null;
  let offset = 0;
  for (const line of source.split("\n")) {
    const words = wordsOf(line, offset);
    offset += line.length + 1;
    // Every start: the PDF line may begin in the middle of a source line.
    for (let start = 0; start < wanted.length && wanted.length - start > (best?.count ?? needed - 1); start++) {
      const { count, first } = inOrder(wanted.slice(start), words);
      if (first && count >= needed && count > (best?.count ?? 0)) best = { count, words, first };
    }
  }
  if (!best) return null;
  const word = clicked && wordsOf(clicked)[0]?.text;
  const hit = word ? best.words.find((w) => w.text === word && w.at >= best!.first.at) : undefined;
  return (hit ?? best.first).at;
}
