import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * A file saved by a visual editor must open in the version books render
 * with, so the platform uses exactly the components @hyperbook/markdown
 * ships. Bump both together.
 */

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const platform = json("../package.json").dependencies as Record<string, string>;
const inBooks = (pkg: string) => json(`../../../packages/markdown/node_modules/${pkg}/package.json`);

describe("element editors", () => {
  it("use the learning map version books render with", () => {
    const books = inBooks("@learningmap/web-component").dependencies["@learningmap/learningmap"];
    expect(platform["@learningmap/learningmap"]).toBe(books);
  });

  it("use the Excalidraw version books render with", () => {
    const books = inBooks("@hyperbook/web-component-excalidraw").dependencies["@excalidraw/excalidraw"];
    expect(platform["@excalidraw/excalidraw"]).toBe(books);
  });

  it("use the Java Memory Playground version books render with", () => {
    const books = inBooks("@java-memory-playground/web-component").dependencies[
      "@java-memory-playground/java-memory-playground"
    ];
    expect(platform["@java-memory-playground/java-memory-playground"]).toBe(books);
  });

  it("use the bitflow version books render with", () => {
    // Books bundle the web component itself; so does the editor.
    expect(platform["@bitflow/web-component"]).toBe(inBooks("@bitflow/web-component").version);
  });

  it("use the struktolab version books render with", () => {
    expect(platform["struktolab"]).toBe(inBooks("struktolab").version);
  });
});
