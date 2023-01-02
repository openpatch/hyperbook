import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook, vfile } from "../src";

describe("hyperbook", () => {
  it("should get navigation", async () => {
    let websiteEn = path.join(__dirname, "..", "..", "..", "website", "en");
    let files = await vfile.list(websiteEn);
    let current = files.find((f) => f.name === "image" && f.folder === "book");
    if (!current) {
      throw Error("Missing file");
    }
    const navigation = await hyperbook.getNavigation(websiteEn, current);
    expect(navigation).toMatchSnapshot();
  });
});
