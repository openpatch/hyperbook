/*
 * Where a comment thread sits in a file (docs/cloud-platform.md, M7): its
 * text with some context on each side, so it can be found again after the
 * file changed. Shared by the server (domain/comments.ts) and the editor
 * (pages/editor/comments.ts).
 *
 * Offsets count UTF-16 code units of the text with its line breaks made
 * "\n" and without a byte order mark, which is how CodeMirror counts.
 */

/** Characters of context kept on each side of a thread's text. */
export const CONTEXT = 32;

export type Anchor = {
  anchorFrom: number;
  anchorExact: string;
  anchorPrefix: string;
  anchorSuffix: string;
};

/** A file's text as offsets count it. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** What a thread keeps of the range from..to of `text`. */
export function quoteOf(text: string, from: number, to: number) {
  return {
    anchorExact: text.slice(from, to),
    anchorPrefix: text.slice(Math.max(0, from - CONTEXT), from),
    anchorSuffix: text.slice(to, to + CONTEXT),
  };
}

/** Length of the common end of `a` and `b`. */
function commonEnd(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** Length of the common start of `a` and `b`. */
function commonStart(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Where a thread's text is in `text` now: of all places it occurs, the one
 * whose surroundings fit its prefix and suffix best, then the one nearest
 * where it was. Null when the text does not occur anymore.
 */
export function relocate(text: string, anchor: Anchor): { from: number; to: number } | null {
  const exact = anchor.anchorExact;
  if (!exact) return null;
  let best: { from: number; score: number; distance: number } | null = null;
  let at = text.indexOf(exact);
  // A short text can occur thousands of times; the first ones will do.
  for (let seen = 0; at !== -1 && seen < 5000; seen++) {
    const before = text.slice(Math.max(0, at - CONTEXT), at);
    const after = text.slice(at + exact.length, at + exact.length + CONTEXT);
    const score = commonEnd(before, anchor.anchorPrefix) + commonStart(after, anchor.anchorSuffix);
    const distance = Math.abs(at - anchor.anchorFrom);
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { from: at, score, distance };
    }
    at = text.indexOf(exact, at + 1);
  }
  return best && { from: best.from, to: best.from + exact.length };
}
