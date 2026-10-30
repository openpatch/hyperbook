import { describe, expect, it } from "vitest";
import { type InlineBlock, findBlocks, resolveSrc } from "../src/web/pages/editor/blocks";

describe("element blocks in pages", () => {
  it("finds struktolab code blocks with their language", () => {
    const page = [
      "# Loops",
      "",
      ":::struktolab{fontSize=16 lang=en}",
      "```",
      "while x > 0:",
      "    x = x - 1",
      "```",
      ":::",
      "",
      "::::struktolab",
      "~~~~",
      "output(1)",
      "",
      "~~~~",
      "::::",
    ].join("\n");
    const blocks = findBlocks(page) as InlineBlock[];
    expect(blocks.map((b) => [b.code, b.lang])).toEqual([
      ["while x > 0:\n    x = x - 1", "en"],
      ["output(1)\n", null],
    ]);
    expect(page.slice(blocks[0]!.from, blocks[0]!.to)).toBe(blocks[0]!.code);
    expect(page.slice(blocks[1]!.from, blocks[1]!.to)).toBe(blocks[1]!.code);
    expect(page.slice(0, blocks[0]!.lineEnd).endsWith("lang=en}")).toBe(true);
  });

  it("takes a struktolab leaf with src for a file, not a block", () => {
    expect(findBlocks('::struktolab{src="a.struktolab"}\n\n```\nx\n```').map((b) => b.type)).toEqual(["file"]);
  });

  it("finds element files a page points at", () => {
    const page =
      'Intro\n::learningmap{height="600px" src="map.learningmap"}\n::jmp{src=/m.jmp hide-sidebar}\n::excalidraw{edit}\n::struktolab{src="/s.struktolab"}';
    expect(findBlocks(page).map((b) => b.type === "file" && [b.kind, b.src])).toEqual([
      ["learningmap", "map.learningmap"],
      ["jmp", "/m.jmp"],
      ["struktolab", "/s.struktolab"],
    ]);
  });

  it("finds the blockflow directives that point at a .sb3 file", () => {
    const page = [
      "::blockflow-player{src=\"/game.sb3\"}",
      "",
      '::::blockflow-editor{title="Tutorial" src="tutorial.sb3"}',
      ":::step{title=\"Welcome\"}",
      "First step",
      ":::",
      "::::",
    ].join("\n");
    expect(findBlocks(page).map((b) => b.type === "file" && [b.kind, b.src])).toEqual([
      ["blockflow", "/game.sb3"],
      ["blockflow", "tutorial.sb3"],
    ]);
  });

  it("finds a blockflow-editor's project file, too", () => {
    const page = '::::blockflow-editor{project="tutorial.blockflow"}\n:::step{title="a"}\nx\n:::\n::::';
    expect(findBlocks(page).map((b) => b.type === "file" && [b.kind, b.src])).toEqual([
      ["blockflow-project", "tutorial.blockflow"],
    ]);
  });

  it("resolves src like the build: public/, book/, next to the page", () => {
    const files = new Set(["public/a.jmp", "book/b.jmp", "book/unit/c.jmp"]);
    const exists = (f: string) => files.has(f);
    expect(resolveSrc("/a.jmp", "book/x.md", exists)).toBe("public/a.jmp");
    expect(resolveSrc("b.jmp", "book/unit/page.md", exists)).toBe("book/b.jmp");
    expect(resolveSrc("c.jmp", "book/unit/page.md", exists)).toBe("book/unit/c.jmp");
    expect(resolveSrc("../b.jmp", "book/unit/page.md", exists)).toBe("book/b.jmp");
    expect(resolveSrc("d.jmp", "book/x.md", exists)).toBeNull();
  });
});
