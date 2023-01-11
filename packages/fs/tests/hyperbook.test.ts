import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook, vfile } from "../src";

describe("hyperbook", () => {
  it("should get navigation", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(hyperbookPath);
    let current = files.find(
      (f) => f.name === "paradigms" && f.folder === "book"
    );
    if (!current) {
      throw Error("Missing file");
    }
    const navigation = await hyperbook.getNavigation(hyperbookPath, current);
    expect(navigation).toMatchSnapshot();
  });
});
