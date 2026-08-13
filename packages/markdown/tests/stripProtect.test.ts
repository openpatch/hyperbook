import { describe, expect, it } from "vitest";
import { stripProtectBlocks } from "../src/stripProtect";

describe("stripProtectBlocks", () => {
  it("removes a block and its password", () => {
    const out = stripProtectBlocks(
      [
        "before",
        ':::protect{password="hyperbook"}',
        "the secret",
        ":::",
        "after",
      ].join("\n"),
    );
    expect(out).not.toContain("the secret");
    expect(out).not.toContain("hyperbook");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("removes nested directives with the outer fence", () => {
    const out = stripProtectBlocks(
      [
        "before",
        '::::protect{password="pw"}',
        ":::alert{info}",
        "the secret",
        ":::",
        "::::",
        "after",
      ].join("\n"),
    );
    expect(out).not.toContain("the secret");
    expect(out).not.toContain("alert");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("keeps examples inside fenced code", () => {
    const source = [
      "```md",
      ':::protect{password="hyperbook"}',
      "example",
      ":::",
      "```",
      "after",
    ].join("\n");
    expect(stripProtectBlocks(source)).toBe(source);
  });

  it("strips to the end when the block is never closed", () => {
    const out = stripProtectBlocks(
      ["before", ':::protect{password="pw"}', "the secret"].join("\n"),
    );
    expect(out.trim()).toBe("before");
  });

  it("leaves markdown without protect blocks untouched", () => {
    const source = "# Title\n\nSome text with ::: colons.\n";
    expect(stripProtectBlocks(source)).toBe(source);
  });

  it("handles several blocks", () => {
    const out = stripProtectBlocks(
      [
        ':::protect{password="a"}',
        "one",
        ":::",
        "middle",
        ':::protect{password="b"}',
        "two",
        ":::",
      ].join("\n"),
    );
    expect(out).not.toContain("one");
    expect(out).not.toContain("two");
    expect(out).toContain("middle");
  });
});
