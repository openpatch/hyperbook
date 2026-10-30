import { afterEach, describe, expect, it } from "vitest";
import {
  clearDocumentationCache,
  DOCUMENTATION,
  readDocumentation,
} from "../src/server/ai/docs";

/*
 * The documentation layer: one local markdown file per directive / file
 * format (hyperbook.md is the vendored https://hyperbook.openpatch.org/llms.txt),
 * read from disk and cached. The server never fetches documentation at runtime.
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

  it("serves the vendored hyperbook llms.txt", () => {
    const text = readDocumentation("hyperbook");
    expect(text).toContain("Hyperbook Documentation");
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
