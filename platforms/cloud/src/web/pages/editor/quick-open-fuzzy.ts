/**
 * Fuzzy search for the quick open dialog (Ctrl/Cmd+P): fzf's V2 algorithm,
 * ported from https://github.com/junegunn/fzf (MIT) — see
 * src/algo/algo.go — so a query matches a path when all of its characters
 * appear in it in order, ranked the way fzf ranks them.
 *
 * fzf is configured with its "path" scheme: "/" is the only delimiter and
 * matches after it get a bonus, which is exactly the shape of file paths.
 */

/** fzf's classes of characters (algo.go), as plain numbers. */
const CharClass = {
  White: 0,
  NonWord: 1,
  Delimiter: 2,
  Lower: 3,
  Upper: 4,
  Letter: 5,
  Number: 6,
} as const;
type CharClass = (typeof CharClass)[keyof typeof CharClass];

const DELIMITER_CHARS = "/";
/** With the path scheme, fzf treats the very start as after a delimiter. */
const INITIAL_CHAR_CLASS: CharClass = CharClass.Delimiter;

/** fzf's scoring constants (algo.go). */
const SCORE_MATCH = 16;
const SCORE_GAP_START = -3;
const SCORE_GAP_EXTENSION = -1;
const BONUS_BOUNDARY = SCORE_MATCH / 2;
const BONUS_NON_WORD = SCORE_MATCH / 2;
const BONUS_CAMEL_123 = BONUS_BOUNDARY + SCORE_GAP_EXTENSION;
const BONUS_CONSECUTIVE = -(SCORE_GAP_START + SCORE_GAP_EXTENSION);
const BONUS_FIRST_CHAR_MULTIPLIER = 2;
/** Path scheme: no extra bonus over bonusBoundary after whitespace. */
const BONUS_BOUNDARY_WHITE = BONUS_BOUNDARY;
const BONUS_BOUNDARY_DELIMITER = BONUS_BOUNDARY + 1;

function charClassOf(ch: string): CharClass {
  if (ch >= "a" && ch <= "z") return CharClass.Lower;
  if (ch >= "A" && ch <= "Z") return CharClass.Upper;
  if (ch >= "0" && ch <= "9") return CharClass.Number;
  if (/\s/.test(ch)) return CharClass.White;
  if (DELIMITER_CHARS.includes(ch)) return CharClass.Delimiter;
  // The non-ASCII classes fzf distinguishes.
  if (/\p{Ll}/u.test(ch)) return CharClass.Lower;
  if (/\p{Lu}/u.test(ch)) return CharClass.Upper;
  if (/\p{N}/u.test(ch)) return CharClass.Number;
  if (/\p{L}/u.test(ch)) return CharClass.Letter;
  return CharClass.NonWord;
}

function bonusFor(prevClass: CharClass, class_: CharClass): number {
  if (class_ >= CharClass.NonWord) {
    if (prevClass === CharClass.White) return BONUS_BOUNDARY_WHITE;
    if (prevClass === CharClass.Delimiter) return BONUS_BOUNDARY_DELIMITER;
    if (prevClass === CharClass.NonWord) return BONUS_BOUNDARY;
  }
  if (
    (prevClass === CharClass.Lower && class_ === CharClass.Upper) ||
    (prevClass !== CharClass.Number && class_ === CharClass.Number)
  ) {
    return BONUS_CAMEL_123;
  }
  if (class_ === CharClass.NonWord || class_ === CharClass.Delimiter)
    return BONUS_NON_WORD;
  if (class_ === CharClass.White) return BONUS_BOUNDARY_WHITE;
  return 0;
}

/**
 * Groups matched indices into the runs of adjacent characters they form,
 * as [start, end) pairs — one <mark> each for the dialog to render.
 * `marks` must be ascending, as fuzzyMatch returns them.
 */
export function markRuns(marks: number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const at of marks) {
    const last = runs[runs.length - 1];
    if (last !== undefined && at === last[1]) last[1] = at + 1;
    else runs.push([at, at + 1]);
  }
  return runs;
}

/** Where in `text` the case-folded `ch` is, at or after `from`. */
function indexOfFolded(text: string, ch: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i]!.toLowerCase() === ch) return i;
  }
  return -1;
}

function lastIndexOfFolded(text: string, ch: string, from: number): number {
  for (let i = text.length - 1; i >= from; i--) {
    if (text[i]!.toLowerCase() === ch) return i;
  }
  return -1;
}

/**
 * What one query against one path produced. `positions` and `score` drive
 * the dialog; `start` and `end` back fzf's tiebreaks (length, begin).
 */
export interface FuzzyMatch {
  /** Where in the path each query character matched, ascending. */
  positions: number[];
  /** Start of the whole matched range. */
  start: number;
  /** End of the whole matched range (exclusive). */
  end: number;
  /** fzf's score, higher is better. */
  score: number;
}

/**
 * fzf's FuzzyMatchV2: a modified Smith-Waterman algorithm that finds the
 * alignment with the highest score, not just the first or the tightest
 * occurrence, and reports where each character matched. `needle` must be
 * lower-case — matching is case-insensitive, but the text keeps its case
 * so the camelCase bonuses still apply. Returns null for no match at all.
 */
export function fuzzyMatch(needle: string, text: string): FuzzyMatch | null {
  const M = needle.length;
  if (M === 0) return { positions: [], start: 0, end: 0, score: 0 };
  if (M > text.length) return null;

  // Phase 1: cheap scan for a leftmost subsequence, to reject non-matching
  // paths without the DP and to narrow its range. The end extends to the
  // last occurrence of the needle's last character.
  let firstIdx = 0;
  let idx = 0;
  let lastIdx = 0;
  let last = needle[0]!;
  let p = 0;
  for (const pchar1 of needle) {
    last = pchar1;
    idx = indexOfFolded(text, pchar1, idx);
    if (idx === -1) return null;
    // Step back one character, but only for the first needle character, so
    // Phase 2 sees the class of the character before the first match, which
    // decides its boundary bonus.
    if (p === 0 && idx > 0) firstIdx = idx - 1;
    lastIdx = idx;
    idx++;
    p++;
  }
  const minIdx = firstIdx;
  const lastOccurrence = lastIndexOfFolded(text, last, lastIdx + 1);
  const maxIdx = (lastOccurrence === -1 ? lastIdx : lastOccurrence) + 1;

  // Phase 2: one pass over the range — the bonus of every position, row 0
  // of the score matrix (matches of the first needle character), where each
  // needle character first occurs, and where the last one occurs last.
  const N = maxIdx - minIdx;
  const T = new Array<string>(N); // text, folded to lower case for matching
  const B = new Array<number>(N); // bonus per position
  const H0 = new Array<number>(N); // score matrix row 0
  const C0 = new Array<number>(N); // consecutive chunk length in row 0
  const F = new Array<number>(M); // first occurrence per needle character
  let maxScore = 0;
  let maxScorePos = 0;
  let pidx = 0;
  let lastIdx2 = 0;
  const pchar0 = needle[0]!;
  let pchar = pchar0;
  let prevH0 = 0;
  let prevClass: CharClass = INITIAL_CHAR_CLASS;
  let inGap = false;
  for (let off = 0; off < N; off++) {
    const ch = text[minIdx + off]!;
    const class_ = charClassOf(ch);
    const folded = ch.toLowerCase();
    T[off] = folded;
    const bonus = bonusFor(prevClass, class_);
    B[off] = bonus;
    prevClass = class_;

    if (folded === pchar) {
      if (pidx < M) {
        F[pidx] = off;
        pidx++;
        pchar = needle[Math.min(pidx, M - 1)]!;
      }
      lastIdx2 = off;
    }

    if (folded === pchar0) {
      const score = SCORE_MATCH + bonus * BONUS_FIRST_CHAR_MULTIPLIER;
      H0[off] = score;
      C0[off] = 1;
      // One character: this row is all there is, so track the best here.
      if (M === 1 && score > maxScore) {
        maxScore = score;
        maxScorePos = off;
        // A boundary match cannot be beaten; stop early.
        if (bonus >= BONUS_BOUNDARY) break;
      }
      inGap = false;
    } else {
      H0[off] = Math.max(
        prevH0 + (inGap ? SCORE_GAP_EXTENSION : SCORE_GAP_START),
        0,
      );
      C0[off] = 0;
      inGap = true;
    }
    prevH0 = H0[off]!;
  }
  if (pidx !== M) return null;
  if (M === 1) {
    const at = minIdx + maxScorePos;
    return { positions: [at], start: at, end: at + 1, score: maxScore };
  }

  // Phase 3: the remaining rows of the score matrix. H[row][col] is the best
  // score of needle[0..row] matching text ending at col; C tracks the length
  // of the run of consecutive matches ending there, which fzf needs to hand
  // out its consecutive bonus correctly.
  const f0 = F[0]!;
  const width = lastIdx2 - f0 + 1;
  const H: number[][] = Array.from({ length: M }, () =>
    new Array<number>(width).fill(0),
  );
  const C: number[][] = Array.from({ length: M }, () =>
    new Array<number>(width).fill(0),
  );
  for (let col = 0; col < width; col++) {
    H[0]![col] = H0[f0 + col]!;
    C[0]![col] = C0[f0 + col]!;
  }
  for (let row = 1; row < M; row++) {
    const f = F[row]!;
    const pcharRow = needle[row]!;
    let inGap2: boolean = false;
    for (let col = f; col <= lastIdx2; col++) {
      const j = col - f0;
      const fromLeft = col === f ? 0 : H[row]![j - 1]!;
      const s2: number =
        fromLeft + (inGap2 ? SCORE_GAP_EXTENSION : SCORE_GAP_START);
      let s1 = 0;
      let consecutive = 0;
      if (T[col] === pcharRow) {
        s1 = H[row - 1]![j - 1]! + SCORE_MATCH;
        let b = B[col]!;
        consecutive = C[row - 1]![j - 1]! + 1;
        if (consecutive > 1) {
          const fb = B[col - consecutive + 1]!;
          // A fresh word boundary is worth more than continuing the chunk.
          if (b >= BONUS_BOUNDARY && b > fb) {
            consecutive = 1;
          } else {
            b = Math.max(b, BONUS_CONSECUTIVE, fb);
          }
        }
        if (s1 + b < s2) {
          s1 += B[col]!;
          consecutive = 0;
        } else {
          s1 += b;
        }
      }
      C[row]![j] = consecutive;
      inGap2 = s1 < s2;
      const score = Math.max(s1, s2, 0);
      if (row === M - 1 && score > maxScore) {
        maxScore = score;
        maxScorePos = col;
      }
      H[row]![j] = score;
    }
  }

  // Phase 4: walk the matrix backwards from the best score to recover where
  // each needle character matched.
  const positions: number[] = [];
  let i = M - 1;
  let j = maxScorePos;
  let preferMatch = true;
  for (;;) {
    const row = i;
    const j0 = j - f0;
    const s = H[row]![j0]!;
    const s1 = i > 0 && j >= F[i]! ? H[i - 1]![j0 - 1]! : 0;
    const s2 = j > F[i]! ? H[i]![j0 - 1]! : 0;
    if (s > s1 && (s > s2 || (s === s2 && preferMatch))) {
      positions.push(j);
      if (i === 0) break;
      i--;
    }
    preferMatch =
      C[row]![j0]! > 1 ||
      (row + 1 < M &&
        j < lastIdx2 &&
        j + 1 >= F[row + 1]! &&
        C[row + 1]![j0 + 1]! > 0);
    j--;
  }
  positions.reverse();
  for (let k = 0; k < positions.length; k++)
    positions[k] = positions[k]! + minIdx;
  return {
    positions,
    start: minIdx + j,
    end: minIdx + maxScorePos + 1,
    score: maxScore,
  };
}
