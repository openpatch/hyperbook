import path from "path";
import { glossary, vfile } from "../src";
import { describe, it, expect } from "vitest";

describe("glossary", () => {
  const relative = (s: string) =>
    path.relative(path.join(__dirname, "fixtures"), s);
  it("should get references", async () => {
    let websiteEn = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(websiteEn);
    let glossaryFile = files.find(
      (f) => f.name === "oop" && f.folder === "glossary"
    );
    if (!glossaryFile) {
      throw Error("Glossary file not found");
    }

    const references = await glossary.getReferences(glossaryFile);
    expect(
      references.map((f) => ({
        ...f,
        root: relative(f.root),
        path: { ...f.path, absolute: relative(f.path.absolute) },
      }))
    ).toMatchSnapshot();
  });
});
