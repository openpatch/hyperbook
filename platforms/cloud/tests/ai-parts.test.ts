import { describe, expect, it } from "vitest";
import { addPart, closeParts, legacyParts } from "../src/shared/ai-parts";

describe("answer parts", () => {
  it("keeps thinking, tools and text in the order they happened", () => {
    let parts = addPart([], { kind: "thinking", text: "Let me " }, 1000);
    parts = addPart(parts, { kind: "thinking", text: "look." }, 1500);
    parts = addPart(parts, { kind: "tool", name: "read_files", detail: "a.md" }, 4000);
    parts = addPart(parts, { kind: "thinking", text: "Now write." }, 5000);
    parts = addPart(parts, { kind: "text", text: "Done" }, 7000);
    parts = addPart(parts, { kind: "text", text: "." }, 7100);
    expect(parts).toEqual([
      // The first stretch of thinking ended when the tool ran.
      { kind: "thinking", text: "Let me look.", startedAt: null, ms: 3000 },
      { kind: "tool", name: "read_files", detail: "a.md" },
      // A second stretch, not appended to the first.
      { kind: "thinking", text: "Now write.", startedAt: null, ms: 2000 },
      { kind: "text", text: "Done." },
    ]);
  });

  it("closes thinking that is still open at the end", () => {
    const parts = closeParts(addPart([], { kind: "thinking", text: "hm" }, 1000), 3500);
    expect(parts).toEqual([{ kind: "thinking", text: "hm", startedAt: null, ms: 2500 }]);
  });

  it("lays out answers stored before parts existed in the old order", () => {
    expect(legacyParts("thought", [{ name: "list_files", detail: null }], "answer")).toEqual([
      { kind: "thinking", text: "thought", startedAt: null, ms: null },
      { kind: "tool", name: "list_files", detail: null },
      { kind: "text", text: "answer" },
    ]);
  });
});
