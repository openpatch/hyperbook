import { describe, expect, it, afterAll } from "vitest";
import { hyperbook, useFileSystem, HyperbookFileSystem } from "../src";
import { nodeFileSystem } from "../src/nodeFileSystem";

/**
 * A hyperbook that is not on a disk, the way VS Code for the Web sees a
 * repository. If this reads, so does a workspace file system, because that is
 * the same three calls.
 */
const memory = (files: Record<string, string>): HyperbookFileSystem => {
  const directories = new Set<string>();
  for (const path of Object.keys(files)) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      directories.add(parts.slice(0, i).join("/") || "/");
    }
  }

  return {
    readFile: async (path) => {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`no such file: ${path}`);
      }
      return new TextEncoder().encode(content);
    },
    readdir: async (path) => {
      if (!directories.has(path)) {
        throw new Error(`no such directory: ${path}`);
      }
      const names = new Set<string>();
      for (const file of Object.keys(files)) {
        if (file.startsWith(`${path}/`)) {
          names.add(file.slice(path.length + 1).split("/")[0]);
        }
      }
      return [...names];
    },
    stat: async (path) => {
      if (directories.has(path)) {
        return { isDirectory: true, isFile: false };
      }
      if (files[path] !== undefined) {
        return { isDirectory: false, isFile: true };
      }
      throw new Error(`no such path: ${path}`);
    },
  };
};

const page = (name: string, index?: number) =>
  `---\nname: ${name}\n${index === undefined ? "" : `index: ${index}\n`}---\n\n# ${name}\n`;

describe("reading a hyperbook off a file system that is not a disk", () => {
  afterAll(() => useFileSystem(nodeFileSystem));

  useFileSystem(
    memory({
      "/book/hyperbook.json": JSON.stringify({ name: "In memory" }),
      "/book/book/index.md": page("Introduction", 0),
      "/book/book/interlude.md": page("Interlude", 2),
      "/book/book/chapter/index.md": page("Chapter", 1),
      "/book/book/chapter/page.md": page("A page"),
    }),
  );

  it("reads the config", async () => {
    expect(await hyperbook.getJson("/book")).toEqual({ name: "In memory" });
  });

  it("finds the config from a file below it", async () => {
    expect(await hyperbook.findRoot("/book/book/chapter/page.md")).toBe(
      "/book",
    );
  });

  it("builds the navigation, in the order the index asks for", async () => {
    const { pages, sections } = await hyperbook.getPagesAndSections("/book");

    expect(pages.map((p) => p.name)).toEqual(["Introduction", "Interlude"]);
    expect(sections.map((s) => s.name)).toEqual(["Chapter"]);
    expect(hyperbook.getPageList(sections, pages).map((p) => p.name)).toEqual([
      "Introduction",
      "Chapter",
      "A page",
      "Interlude",
    ]);
  });
});
