import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook, vfile } from "../src";

describe("hyperbook", () => {
  const relative = (s: string) =>
    path.relative(path.join(__dirname, "fixtures"), s);
  const makeFileRelative = (f: vfile.VFile) => {
    if ("references" in f) {
      return {
        ...f,
        root: relative(f.root),
        path: { ...f.path, absolute: relative(f.path.absolute) },
        elements: [],
        references: f.references.map((f) => ({
          ...f,
          root: relative(f.root),
          path: { ...f.path, absolute: relative(f.path.absolute) },
        })),
      } as vfile.VFileGlossary;
    }
    return {
      ...f,
      root: relative(f.root),
      path: { ...f.path, absolute: relative(f.path.absolute) },
    };
  };
  it("should get navigation", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(hyperbookPath);
    files = files.map(makeFileRelative);
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
