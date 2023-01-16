import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import { handlebars, registerHelpers } from "../src/handlebars";
import path from "path";

describe("handlebars", () => {
  it("should resolve rfile", async () => {
    registerHelpers(handlebars);
    const t = handlebars.compile("{{{ rfile src }}}");
    const prettierFile = await fs.readFile(
      path.join(__dirname, "..", "..", "..", "prettier.config.js"),
      "utf8"
    );
    const markdown = t({ src: "/prettier.config.js" });
    expect(markdown).toEqual(prettierFile);
  });
  it("should resolve rbase64", async () => {
    registerHelpers(handlebars);
    const t = handlebars.compile("{{{ rbase64 src }}}");
    const markdown = t({ src: "/packages/fs/tests/fixtures/test_image.png" });
    expect(markdown).toMatchSnapshot();
  });
});
