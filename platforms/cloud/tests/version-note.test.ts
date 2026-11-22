import { describe, expect, it } from "vitest";
import { cleanNote } from "../src/server/ai/version-note";

describe("cleanNote", () => {
  it("keeps the first line, without labels, quotes and a final period", () => {
    expect(cleanNote("\n  Note: „Neues Kapitel zu Linsen“.\nMore")).toBe("Neues Kapitel zu Linsen");
    expect(cleanNote("**Fixes typos in the intro**")).toBe("Fixes typos in the intro");
    expect(cleanNote("   ")).toBe("");
  });

  it("stays within the note field's 200 characters", () => {
    const note = cleanNote("a".repeat(300));
    expect(note).toHaveLength(200);
    expect(note.endsWith("…")).toBe(true);
  });
});
