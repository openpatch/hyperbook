/**
 * Fuzzy search for the quick open dialog (Ctrl/Cmd+P). A query matches a
 * path when all of its characters appear in the path in order — so "sovh"
 * finds "sortierverfahren.md" the way editors like VS Code do.
 */

/**
 * Where in `text` the characters of `needle` match: one index per query
 * character, in order, or null when the query does not match at all.
 * Callers pass both strings already lower-cased, so matching is
 * case-insensitive but only one case-folding pass happens per path.
 *
 * The positions come from the two passes fzf makes: a forward pass finds
 * the earliest end the query can reach, a backward pass then pulls the
 * match as far right as it goes. Together they pick the tightest
 * alignment ending there, so "abc" on "a-b-a-b-c" matches the second "ab"
 * — keeping both what gets highlighted and what gets scored compact.
 */
export function fuzzyMatch(needle: string, text: string): number[] | null {
  let last = -1;
  for (const ch of needle) {
    const at = text.indexOf(ch, last + 1);
    if (at === -1) return null;
    last = at;
  }
  const positions = new Array<number>(needle.length);
  for (let i = needle.length - 1; i >= 0; i--) {
    last = text.lastIndexOf(needle[i]!, last);
    positions[i] = last;
    last -= 1;
  }
  return positions;
}

/**
 * How good a match is; higher sorts first. Rewards follow what people
 * usually mean when they type a query: characters typed together match
 * together, matches at the starts of words (after `/ - . _` or before a
 * camelCase hump) and matches in the file name rather than its folders
 * all count, while every character a match skips over, and matches buried
 * deep in the path, count against.
 */
export function fuzzyScore(positions: number[], path: string): number {
  if (positions.length === 0) return 0;
  const slash = path.lastIndexOf("/");
  const isUpper = (c: string) => c !== c.toLowerCase();
  let score = 0;
  let prev = -2;
  for (const at of positions) {
    if (at === prev + 1) score += 8;
    const before = at > 0 ? path[at - 1]! : "/";
    if ("/-._ ".includes(before)) score += 5;
    else if (isUpper(path[at]!) && !isUpper(before)) score += 5;
    if (at > slash) score += 3;
    prev = at;
  }
  // Every character between the first and last match is one the query
  // jumped over — two points per skipped character, so that typing "srt"
  // prefers "soR Tieren" over scattered letters.
  score -=
    2 *
    (positions[positions.length - 1]! - positions[0]! - positions.length + 1);
  score -= positions[0]! / 10;
  return score;
}
