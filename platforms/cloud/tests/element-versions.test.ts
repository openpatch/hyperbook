import { existsSync, readFileSync } from "node:fs";
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

  it("serve a blockflow bundle whose embed entries the visual editors speak to", () => {
    // The platform frames /blockflow/embed-editor.html and embed-generator.html
    // and talks blockflow's embed protocol (ready/load/change/saved/error),
    // which exists since blockflow v0.2.0; the pin lives in postbuild.mjs.
    const postbuild = readFileSync(new URL("../../../packages/markdown/postbuild.mjs", import.meta.url), "utf8");
    const tag = /releases\/download\/(blockflow-v[\d.]+)\/dist-embedded\.zip/.exec(postbuild)?.[1];
    expect(tag).toMatch(/^blockflow-v\d+\.\d+\.\d+$/);
    const parts = tag!.slice("blockflow-v".length).split(".").map(Number);
    const [major, minor] = [parts[0] ?? 0, parts[1] ?? 0];
    expect(major > 0 || minor >= 2).toBe(true);
    // When the bundle is vendored (built), it must carry the entries + manifest.
    const manifestPath = new URL("../../../packages/markdown/dist/assets/directive-blockflow/manifest.json", import.meta.url);
    if (existsSync(manifestPath)) {
      const manifest = json("../../../packages/markdown/dist/assets/directive-blockflow/manifest.json");
      expect(manifest.entries).toContain("embed-editor.html");
      expect(manifest.entries).toContain("embed-generator.html");
    }
  });
});
