import { describe, expect, it } from "vitest";
// @ts-expect-error The CodeMirror bundle is JavaScript.
import * as guides from "../codemirror-bundle/indent-guides.js";

type Structure = { indents: number[]; guides: number[][] };
const computeIndentGuides: (lines: string[], tabSize: number) => Structure =
  guides.computeIndentGuides;
const activeIndentGuide: (
  structure: Structure,
  lineIndex: number,
) => { column: number; from: number; to: number } | null =
  guides.activeIndentGuide;

const structureOf = (code: string, tabSize = 4) =>
  computeIndentGuides(code.split("\n"), tabSize);

describe("computeIndentGuides", () => {
  it("puts a guide at the column of every enclosing line", () => {
    const { guides } = structureOf(
      [
        "def f(n):",
        "    for i in range(n):",
        "        if i % 2:",
        "            print(i)",
        "    return n",
        "print(f(3))",
      ].join("\n"),
    );
    expect(guides).toEqual([[], [0], [0, 4], [0, 4, 8], [0], []]);
  });

  it("follows the indentation the code actually uses", () => {
    const { guides } = structureOf(
      [
        "if a:",
        "  if b:",
        "    x = 1",
        "y = 2",
        "if c:",
        "\tif d:",
        "\t\tz = 3",
      ].join("\n"),
    );
    expect(guides).toEqual([[], [0], [0, 2], [], [], [0], [0, 4]]);
  });

  it("carries a block's guides across blank lines but not past its end", () => {
    const { guides, indents } = structureOf(
      [
        "def f():",
        "",
        "    x = 1",
        "    ",
        "    y = 2",
        "",
        "print(f())",
        "",
      ].join("\n"),
    );
    expect(guides).toEqual([[], [0], [0], [0], [0], [], [], []]);
    expect(indents).toEqual([0, -1, 4, -1, 4, -1, 0, -1]);
  });
});

describe("activeIndentGuide", () => {
  const code = [
    "def f(n):", // 0
    "    for i in range(n):", // 1
    "        print(i)", // 2
    "", // 3
    "        print(-i)", // 4
    "    return n", // 5
    "print(f(3))", // 6
  ].join("\n");
  const structure = structureOf(code);

  it("highlights the block the cursor is in", () => {
    expect(activeIndentGuide(structure, 4)).toEqual({
      column: 4,
      from: 2,
      to: 4,
    });
    expect(activeIndentGuide(structure, 5)).toEqual({
      column: 0,
      from: 1,
      to: 5,
    });
  });

  it("highlights the block a header line opens", () => {
    expect(activeIndentGuide(structure, 1)).toEqual({
      column: 4,
      from: 2,
      to: 4,
    });
    expect(activeIndentGuide(structure, 0)).toEqual({
      column: 0,
      from: 1,
      to: 5,
    });
  });

  it("highlights nothing on top-level code", () => {
    expect(activeIndentGuide(structure, 6)).toBeNull();
  });
});
