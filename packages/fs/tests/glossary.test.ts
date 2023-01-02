import path from "path";
import { glossary, vfile } from "../src";
import { describe, it, expect } from "vitest";

describe("glossary", () => {
  it("should get references", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    let files = await vfile.list(websiteEn);
    let glossaryFile = files.find(
      (f) => f.name === "oop" && f.folder === "glossary"
    );
    if (!glossaryFile) {
      throw Error("Glossary file not found");
    }

    expect(await glossary.getReferences(glossaryFile)).toMatchSnapshot();
  });
});
