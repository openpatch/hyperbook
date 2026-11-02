import { afterEach, describe, expect, it } from "vitest";
import {
  clearDocumentationCache,
  DOCUMENTATION,
  documentationKey,
  readDocumentation,
} from "../src/server/ai/docs";

/*
 * The documentation layer: one local markdown file per directive / file
 * format, read from disk and cached; hyperbook.md (the vendored
 * https://hyperbook.openpatch.org/llms.txt) is served by section. The server never fetches documentation at runtime.
 */

afterEach(() => clearDocumentationCache());

describe("readDocumentation", () => {
  it("serves every documented topic from its local file", () => {
    for (const key of Object.keys(DOCUMENTATION) as (keyof typeof DOCUMENTATION)[]) {
      const text = readDocumentation(key);
      expect(text, `missing docs for ${key}`).not.toBeNull();
      expect(text!.length).toBeGreaterThan(100);
    }
  });

  it("serves a topic's sections of the vendored llms.txt, not the whole file", () => {
    const text = readDocumentation("alert")!;
    expect(text).toMatch(/^# Alert/);
    expect(text).not.toContain("# Changelog");
    expect(text).not.toContain("# Audio");
    expect(text.length).toBeLessThan(5_000);
  });

  it("puts a curated file before the official reference", () => {
    const text = readDocumentation("pyide")!;
    expect(text.indexOf("# pyide (Python IDE)")).toBe(0);
    expect(text).toContain("Official reference:");
    expect(text).toMatch(/^# Pyide/m);
  });

  it("answers directive names documented under another topic", () => {
    expect(documentationKey("tab")).toBe("tabs");
    expect(documentationKey("blockflow-player")).toBe("blockflow");
    expect(documentationKey("P5")).toBe("p5");
    expect(documentationKey("nonsense")).toBeNull();
  });

  it("caches reads", () => {
    clearDocumentationCache();
    const first = readDocumentation("p5");
    expect(readDocumentation("p5")).toBe(first);
  });

  it("covers the file-based formats the prompt names", () => {
    for (const key of ["bitflow", "blockflow", "struktolab", "jmp", "excalidraw"] as const) {
      expect(readDocumentation(key)).toContain("write_file");
    }
  });
});
