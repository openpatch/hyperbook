import { describe, expect, it } from "vitest";
import {
  fuzzyMatch,
  markRuns,
  rankMatches,
} from "../src/web/pages/editor/quick-open-fuzzy";

/** Query and path the way the dialog passes them: query lower-cased. */
function match(query: string, path: string) {
  return fuzzyMatch(query.toLowerCase(), path);
}

describe("fuzzyMatch (fzf V2)", () => {
  it("matches a plain substring, at a word boundary", () => {
    const path = "content/sortierverfahren.md";
    const m = match("sortier", path)!;
    expect(m).not.toBeNull();
    expect(m.positions).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(path.slice(m.start, m.end)).toBe("sortier");
  });

  it("matches characters spread over the path", () => {
    const path = "content/sortierverfahren.md";
    const m = match("sovh", path)!;
    expect(m).not.toBeNull();
    expect(m.positions).toEqual(m.positions.slice().sort((a, b) => a - b));
    // every matched character is one the query asked for
    expect(m.positions.map((at) => path[at])).toEqual(["s", "o", "v", "h"]);
  });

  it("finds the best alignment, not just the first (V2, unlike V1)", () => {
    // "abc" on "a-b-a-b-c": the trailing "ab" plus the "c" scores higher
    // than "a-b" because of the consecutive bonus.
    expect(fuzzyMatch("abc", "a-b-a-b-c")!.positions).toEqual([4, 6, 8]);
  });

  it("prefers boundaries: fuzzy-finder beats fuzzyfinder on ff", () => {
    // fzf's own example: the "f" after the boundary is worth more, even
    // though the whole match is one character longer.
    const withBoundary = fuzzyMatch("ff", "fuzzy-finder")!;
    const buried = fuzzyMatch("ff", "fuzzyfinder")!;
    expect(withBoundary.score).toBeGreaterThan(buried.score);
  });

  it("scores fzf-style: foobar beats foo-bar on foob", () => {
    // fzf's fix for the boundary anomaly: consecutive chunks get a bonus,
    // so the gapless "foobar" still wins.
    const foobar = fuzzyMatch("foob", "foobar")!;
    const fooBar = fuzzyMatch("foob", "foo-bar")!;
    expect(foobar).not.toBeNull();
    expect(fooBar).not.toBeNull();
    expect(foobar.score).toBeGreaterThan(fooBar.score);
  });

  it("returns the empty match for the empty query", () => {
    expect(fuzzyMatch("", "anything.md")).toEqual({
      positions: [],
      start: 0,
      end: 0,
      score: 0,
    });
  });

  it("returns null when a character is missing or out of order", () => {
    expect(match("xyz", "content/sortierverfahren.md")).toBeNull();
    // "f" and "v" are both in there, but only in the order v then f.
    expect(match("fv", "content/sortierverfahren.md")).toBeNull();
  });

  it("lets one path character match only one query character", () => {
    expect(match("lll", "hallo.md")).toBeNull(); // only two "l" in there
    expect(match("ll", "hallo.md")!.positions).toEqual([2, 3]);
  });

  it("scores a match in the file name the same as the same match in a folder", () => {
    // fzf gives both the same score — both are "fir" at a boundary after
    // "/". The dialog breaks such ties by preferring the file name.
    const inName = match("fir", "book/unterricht/first-steps.md")!;
    const inFolder = match("fir", "book/unterricht/firefox/readme.md")!;
    expect(inName.score).toBe(inFolder.score);
    expect(inName.positions).toEqual([16, 17, 18]);
  });
});

describe("markRuns", () => {
  it("groups adjacent marks into one run, as [start, end)", () => {
    expect(markRuns([16, 17, 18])).toEqual([[16, 19]]);
    expect(markRuns([0, 2, 4, 5])).toEqual([
      [0, 1],
      [2, 3],
      [4, 6],
    ]);
  });

  it("returns no runs for no marks", () => {
    expect(markRuns([])).toEqual([]);
  });

  it("covers a mark at the very end", () => {
    expect(markRuns([4])).toEqual([[4, 5]]);
  });
});

describe("rankMatches", () => {
  const paths = [
    "book/unterricht/firefox/readme.md",
    "book/unterricht/first-steps.md",
    "content/first-things/overview.md",
  ];

  it("ranks by fzf score, then prefers matches in the file name", () => {
    // Both "fir"-at-a-boundary matches tie on score; the one in the file
    // name wins over the one in a folder.
    expect(rankMatches("fir", paths).map((m) => m.path)).toEqual([
      "book/unterricht/first-steps.md",
      "content/first-things/overview.md",
      "book/unterricht/firefox/readme.md",
    ]);
  });

  it("drops paths that do not match", () => {
    expect(rankMatches("xyz", paths)).toEqual([]);
  });

  it("keeps every path for the empty query, alphabetical", () => {
    expect(rankMatches("", ["b.md", "a.md"]).map((m) => m.path)).toEqual([
      "a.md",
      "b.md",
    ]);
  });
});
