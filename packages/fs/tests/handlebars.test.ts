import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs/promises";
import { handlebars, registerHelpers } from "../src/handlebars";
import path from "path";
import { setFileSystemAdapter, setPathAdapter } from "../src/fs-adapter";
import { nodeFileSystemAdapter, nodePathAdapter } from "../src/fs-adapter-node";

// Initialize adapters for Node environment
beforeAll(() => {
  setFileSystemAdapter(nodeFileSystemAdapter);
  setPathAdapter(nodePathAdapter);
});

describe("handlebars", () => {
  it("should resolve rfile", async () => {
    registerHelpers(handlebars);
    const t = handlebars.compile("{{{ rfile src }}}");
    const prettierFile = await fs.readFile(
      path.join(__dirname, "..", "..", "..", "prettier.config.json"),
      "utf8",
    );
    const markdown = t({ src: "/prettier.config.json" });
    expect(markdown).toEqual(prettierFile);
  });
  it("should resolve rbase64", async () => {
    registerHelpers(handlebars);
    const t = handlebars.compile("{{{ rbase64 src }}}");
    const markdown = t({ src: "/packages/fs/tests/fixtures/test_image.png" });
    expect(markdown).toMatchSnapshot();
  });
});
