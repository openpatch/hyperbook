import { describe, expect, it } from "vitest";
import { findInSource } from "../src/web/pages/editor/pdf-sync";

const SOURCE = `= Optics

Light travels in *straight* lines,
until it meets a #emph[lens] or a mirror.

Refraction bends light at a boundary.
`;

describe("findInSource", () => {
  it("finds a PDF line in the source, at the clicked word", () => {
    expect(findInSource(SOURCE, "Light travels in straight lines,", "straight")).toBe(SOURCE.indexOf("straight"));
    expect(findInSource(SOURCE, "until it meets a lens or a mirror.", "lens")).toBe(SOURCE.indexOf("lens"));
    expect(findInSource(SOURCE, "Optics")).toBe(SOURCE.indexOf("Optics"));
  });

  it("finds a line that starts mid-paragraph, and gives up on unknown text", () => {
    expect(findInSource(SOURCE, "bends light at a", "at")).toBe(SOURCE.indexOf("at a boundary"));
    expect(findInSource(SOURCE, "Something else entirely")).toBeNull();
    expect(findInSource(SOURCE, "  ")).toBeNull();
  });
});
