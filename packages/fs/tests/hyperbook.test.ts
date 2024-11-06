import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook, vfile } from "../src";

describe("hyperbook", () => {
  it("should get navigation", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(hyperbookPath);
    let current = files.find(
      (f) => f.name === "paradigms" && f.folder === "book",
    );
    if (!current) {
      throw Error("Missing file");
    }
    const pagesAndSections = await hyperbook.getPagesAndSections(hyperbookPath);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    const navigation = await hyperbook.getNavigationForFile(pageList, current);
    expect(navigation).toMatchSnapshot();
  });
});
