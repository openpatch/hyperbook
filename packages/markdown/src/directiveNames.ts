/**
 * Every directive name Hyperbook understands, for suggesting a fix when a page
 * uses one it does not.
 *
 * Whether a directive is *known* on a page is decided at render time by the
 * plugins themselves (`registerDirective`); this list is only consulted for
 * "did you mean". A stale entry costs a worse suggestion, never a wrong
 * verdict. `tests/directiveNames.test.ts` keeps it in step with the plugins.
 */
export const DIRECTIVE_NAMES: readonly string[] = [
  "abc-music",
  "alert",
  "archive",
  "audio",
  "bitflow",
  "blockflow-editor",
  "blockflow-player",
  "bookmarks",
  "collapsible",
  "download",
  "embed",
  "excalidraw",
  "geogebra",
  "h5p",
  "jmp",
  "jsxgraph",
  "kirimoto",
  "learningmap",
  "mermaid",
  "multievent",
  "onlineide",
  "openscad",
  "p5",
  "pagelist",
  "passwordlist",
  "pdf",
  "plantuml",
  "protect",
  "pyide",
  "qr",
  "scratchblock",
  "slideshow",
  "sqlide",
  "struktog",
  "struktolab",
  "tabs",
  "term",
  "textinput",
  "tiles",
  "typst",
  "video",
  "webide",
  "youtube",
];

/**
 * Names that are only meaningful inside another directive, with the parent
 * they belong to. Used outside it, the parent never claims them and they are
 * unpacked like any unknown directive.
 */
export const CHILD_DIRECTIVES: Readonly<Record<string, string>> = {
  tab: "tabs",
  tile: "tiles",
  step: "blockflow-editor",
  t: "term",
  file: "pyide, webide, typst or openscad",
};

/**
 * Edit distance counting a swap of neighbours as one edit (optimal string
 * alignment), since "alret" for "alert" is the typo people actually make.
 */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * The candidate closest to `word`, or undefined when none is close enough to
 * be a plausible typo of it.
 */
export function closest(
  word: string,
  candidates: readonly string[],
): string | undefined {
  const lower = word.toLowerCase();
  const squash = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
  const exact = candidates.find((c) => squash(c) === squash(word));
  if (exact) return exact;
  // One written out further, or cut short: "warning" for "warn".
  const prefix = candidates.find(
    (c) =>
      c.length >= 3 &&
      lower.length >= 3 &&
      (squash(word).startsWith(squash(c)) ||
        squash(c).startsWith(squash(word))),
  );
  if (prefix) return prefix;

  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    // Single letters ("t") are too short to be anyone's typo target.
    if (candidate.length < 3) continue;
    const d = distance(lower, candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  const allowed = Math.max(1, Math.floor(Math.max(lower.length, 3) / 3));
  return bestDistance <= allowed ? best : undefined;
}

/**
 * The known directive closest to `name`, or undefined when nothing is close
 * enough to be a plausible typo.
 */
export function suggestDirective(name: string): string | undefined {
  return closest(name, [...DIRECTIVE_NAMES, ...Object.keys(CHILD_DIRECTIVES)]);
}
