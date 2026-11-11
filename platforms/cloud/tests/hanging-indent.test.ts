import { describe, expect, it } from "vitest";
import { hangingColumns } from "../src/web/pages/editor/hanging-indent";

describe("hangingColumns", () => {
  it("indents wrapped lines like their first line, tabs to the next stop", () => {
    expect(hangingColumns("plain text", 4, false)).toBe(0);
    expect(hangingColumns("    code", 4, false)).toBe(4);
    expect(hangingColumns("\t  x", 4, false)).toBe(6);
    expect(hangingColumns("   ", 4, false)).toBe(0);
  });

  it("lines Markdown list items and quotes up under their text", () => {
    expect(hangingColumns("- item", 4, true)).toBe(2);
    expect(hangingColumns("  12. item", 4, true)).toBe(6);
    expect(hangingColumns("- [x] done", 4, true)).toBe(6);
    expect(hangingColumns("> > quote", 4, true)).toBe(4);
    expect(hangingColumns("- item", 4, false)).toBe(0);
  });
});
