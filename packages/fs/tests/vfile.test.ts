import path from "path";
import { describe, it, expect } from "vitest";
import * as vfile from "../src/vfile";

describe("list", () => {
  it("should list all", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    expect(await vfile.list(websiteEn)).toMatchSnapshot();
  });

  it("should list for folder book", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    expect(await vfile.listForFolder(websiteEn, "book")).toMatchSnapshot();
  });

  it("should include main index", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    const files = await vfile.listForFolder(websiteEn, "book");
    const file = files.find((f) => f.path.href === "/");
    expect(file).toBeDefined();
  });
});

describe("getMarkdown", () => {
  it("should get markdown from template", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    let files = await vfile.list(websiteEn);
    let templateFile = files.find(
      (f) => f.name === "template-demo-yaml" && f.folder === "book"
    );
    if (!templateFile) {
      throw Error("Template not found");
    }

    expect(await vfile.getMarkdown(templateFile)).toMatchSnapshot();
  });
});

describe("getDirectory", () => {
  it("should get directory", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    let directory = await vfile.getDirectory(websiteEn, "book");

    expect(directory).toMatchSnapshot();
  });

  it("should include main index", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    let directory = await vfile.getDirectory(websiteEn, "book");
    expect(directory.index).toBeDefined();
  });
});

describe("extractLines", () => {
  const text =
    "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10";
  it("should extract lines by range", () => {
    const extractedLines = vfile.extractLines(text, "2-4", "...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with gaps", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8", "...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with no ellipsis", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with custom ellipsis", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8", "// ...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines and not add ellipsis on first and last line", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,10", "// ...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should return full content", () => {
    const extractedLines = vfile.extractLines(text);
    expect(extractedLines).toMatchSnapshot();
  });
});
