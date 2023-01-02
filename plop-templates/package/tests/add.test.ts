import { describe, it, expect } from "vitest";
import { add } from "../src/add";

describe("add", () => {
  it("should return 4", () => {
    expect(add(2, 2)).toEqual(4);
  });
});
