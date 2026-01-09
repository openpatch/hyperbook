import { describe, expect, it, beforeEach } from "vitest";
import fs from "fs/promises";
import { handlebars, registerHelpers } from "../src/handlebars";
import path from "path";

describe("handlebars", () => {
  beforeEach(() => {
    registerHelpers(handlebars);
  });

  it("should resolve rfile", async () => {
    const t = handlebars.compile("{{{ rfile src }}}");
    const prettierFile = await fs.readFile(
      path.join(__dirname, "..", "..", "..", "prettier.config.json"),
      "utf8",
    );
    const markdown = t({ src: "/prettier.config.json" });
    expect(markdown).toEqual(prettierFile);
  });
  it("should resolve rbase64", async () => {
    const t = handlebars.compile("{{{ rbase64 src }}}");
    const markdown = t({ src: "/packages/fs/tests/fixtures/test_image.png" });
    expect(markdown).toMatchSnapshot();
  });
  it("should format date with dateformat", () => {
    const t = handlebars.compile("{{ dateformat date format }}");
    const result = t({ date: "2026-01-09T19:29:01.557Z", format: "YYYY-MM-DD" });
    expect(result).toEqual("2026-01-09");
  });
  it("should format date with time using dateformat", () => {
    const t = handlebars.compile("{{ dateformat date format }}");
    const result = t({ date: "2026-01-09T19:29:01.557Z", format: "DD.MM.YYYY HH:mm:ss" });
    expect(result).toMatch(/09\.01\.2026 \d{2}:29:01/);
  });
  it("should use default format when format is not provided", () => {
    const t = handlebars.compile("{{ dateformat date }}");
    const result = t({ date: "2026-01-09T19:29:01.557Z" });
    expect(result).toEqual("2026-01-09");
  });
  it("should truncate string by character limit", () => {
    const t = handlebars.compile("{{ truncate str limit suffix }}");
    const result = t({ str: "Hello World, this is a long string", limit: 11, suffix: "..." });
    expect(result).toEqual("Hello World...");
  });
  it("should not truncate string shorter than limit", () => {
    const t = handlebars.compile("{{ truncate str limit suffix }}");
    const result = t({ str: "Hello", limit: 10, suffix: "..." });
    expect(result).toEqual("Hello");
  });
  it("should truncate by words", () => {
    const t = handlebars.compile("{{ truncateWords str limit suffix }}");
    const result = t({ str: "one two three four five six", limit: 3, suffix: "..." });
    expect(result).toEqual("one two three...");
  });
  it("should not truncate words if fewer than limit", () => {
    const t = handlebars.compile("{{ truncateWords str limit suffix }}");
    const result = t({ str: "one two", limit: 5, suffix: "..." });
    expect(result).toEqual("one two");
  });
});
