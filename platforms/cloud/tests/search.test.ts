import { describe, expect, it } from "vitest";
import {
  InvalidQueryError,
  type SearchQuery,
  compileQuery,
  replaceAll,
  searchFiles,
} from "../src/shared/search";

const q = (pattern: string, options: Partial<SearchQuery> = {}): SearchQuery => ({
  pattern,
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  ...options,
});

describe("searching the book", () => {
  it("finds matches with their line and a preview", () => {
    const result = searchFiles(
      [
        { path: "book/a.md", text: "# Title\n\n  Some text with a word.\nword again" },
        { path: "book/b.md", text: "nothing here" },
      ],
      q("word"),
    );
    expect(result.total).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.files.map((f) => f.path)).toEqual(["book/a.md"]);
    const [first, second] = result.files[0]!.matches;
    expect(first).toMatchObject({ line: 3, preview: "Some text with a word." });
    expect(first!.preview.slice(first!.previewFrom, first!.previewTo)).toBe("word");
    expect(second).toMatchObject({ line: 4, from: 34, to: 38 });
  });

  it("treats the pattern as text unless asked for a regular expression", () => {
    const files = [{ path: "a.md", text: "a.b axb" }];
    expect(searchFiles(files, q("a.b")).total).toBe(1);
    expect(searchFiles(files, q("a.b", { regex: true })).total).toBe(2);
  });

  it("respects case and whole words, also beyond ASCII", () => {
    const files = [{ path: "a.md", text: "Bär bärig Bär" }];
    expect(searchFiles(files, q("bär")).total).toBe(3);
    expect(searchFiles(files, q("bär", { caseSensitive: true })).total).toBe(1);
    expect(searchFiles(files, q("Bär", { wholeWord: true })).total).toBe(2);
  });

  it("clips long lines around the match", () => {
    const text = `${"x".repeat(200)} needle ${"y".repeat(400)}`;
    const [match] = searchFiles([{ path: "a.md", text }], q("needle")).files[0]!.matches;
    expect(match!.preview.startsWith("…")).toBe(true);
    expect(match!.preview.length).toBeLessThan(200);
    expect(match!.preview.slice(match!.previewFrom, match!.previewTo)).toBe("needle");
  });

  it("lists at most the limit, and counts the rest", () => {
    const result = searchFiles(
      [
        { path: "a.md", text: "a a a" },
        { path: "b.md", text: "a a" },
      ],
      q("a"),
      4,
    );
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(true);
    expect(result.files.map((f) => f.matches.length)).toEqual([3, 1]);
  });

  it("skips empty matches and reports a broken expression", () => {
    expect(searchFiles([{ path: "a.md", text: "abc" }], q("x*", { regex: true })).total).toBe(0);
    expect(compileQuery(q(""))).toBeNull();
    expect(() => compileQuery(q("(", { regex: true }))).toThrow(InvalidQueryError);
  });
});

describe("replacing in the book", () => {
  it("replaces text literally, $ included", () => {
    expect(replaceAll("a.b a.b", q("a.b"), "$1")).toEqual({ text: "$1 $1", count: 2 });
  });

  it("expands groups of a regular expression", () => {
    const query = q("(\\w+)@(?<host>\\w+)", { regex: true });
    expect(replaceAll("me@home you@work", query, "$2:$1 $<host> $$").text).toBe("home:me home $ work:you work $");
  });

  it("works with lookarounds", () => {
    expect(replaceAll("foobar foobaz", q("foo(?=bar)", { regex: true }), "[$&]").text).toBe("[foo]bar foobaz");
  });

  it("only replaces whole words when asked", () => {
    expect(replaceAll("cat catalog cat", q("cat", { wholeWord: true }), "dog")).toEqual({
      text: "dog catalog dog",
      count: 2,
    });
  });
});
