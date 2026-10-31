import { describe, expect, it } from "vitest";
import {
  fuzzyMatch,
  fuzzyScore,
} from "../src/web/pages/editor/quick-open-fuzzy";

/** Query and path ready for fuzzyMatch: lower-cased, like the dialog does. */
function match(query: string, path: string) {
  return fuzzyMatch(query.toLowerCase(), path.toLowerCase());
}

describe("fuzzyMatch", () => {
  it("matches a plain substring", () => {
    expect(match("sortier", "content/sortierverfahren.md")).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it("matches characters spread over the path", () => {
    // s-o-...-v-...-h: like typing "sovh" for sortierverfahren.
    expect(match("sovh", "content/sortierverfahren.md")).not.toBeNull();
    expect(match("sv", "content/sortierverfahren.md")).toEqual([
      "content/sortierverfahren.md".indexOf("s", 1),
      "content/sortierverfahren.md".indexOf("v"),
    ]);
  });

  it("finds the tightest alignment, like fzf", () => {
    // "abc" on "a-b-a-b-c": the trailing "ab" plus the "c", not "a-b".
    expect(fuzzyMatch("abc", "a-b-a-b-c")).toEqual([4, 6, 8]);
  });

  it("returns the empty list for the empty query", () => {
    expect(fuzzyMatch("", "anything.md")).toEqual([]);
  });

  it("returns null when a character is missing or out of order", () => {
    expect(match("xyz", "content/sortierverfahren.md")).toBeNull();
    // "f" and "v" are both in there, but only in the order v then f.
    expect(match("fv", "content/sortierverfahren.md")).toBeNull();
  });

  it("lets one path character match only one query character", () => {
    expect(match("lll", "hallo.md")).toBeNull(); // only two "l" in there
    expect(match("ll", "hallo.md")).toEqual([2, 3]);
  });
});

describe("fuzzyScore", () => {
  it("ranks a word start in the file name above the same letters buried in folders", () => {
    const path = "content/informatik/algorithmen/sortierverfahren.md";
    const wordStart = match("sort", path)!;
    const buried = match(
      "sort",
      "content/sortierdaten/algorithmen/vererbung.md",
    )!;
    // the match really is the file name's first word
    expect(path.slice(wordStart[0]!, wordStart[0]! + 4)).toBe("sort");
    expect(fuzzyScore(wordStart, path)).toBeGreaterThan(
      fuzzyScore(buried, "content/sortierdaten/algorithmen/vererbung.md"),
    );
  });

  it("rewards typed-together matches over spread-out ones", () => {
    const together = match("srt", "content/sortieren.md")!;
    const spread = match("srt", "content/s-ra-t.md")!;
    expect(fuzzyScore(together, "content/sortieren.md")).toBeGreaterThan(
      fuzzyScore(spread, "content/s-ra-t.md"),
    );
  });

  it("rewards matches in the file name over matches in folders", () => {
    const inName = match("md", "content/vorlesung/folien.md")!;
    const inDir = match("md", "content/moodle/folien.txt")!;
    expect(fuzzyScore(inName, "content/vorlesung/folien.md")).toBeGreaterThan(
      fuzzyScore(inDir, "content/moodle/folien.txt"),
    );
  });

  it("gives every path the same score for the empty query", () => {
    expect(fuzzyScore([], "a.md")).toBe(fuzzyScore([], "some/long/b.md"));
  });
});
