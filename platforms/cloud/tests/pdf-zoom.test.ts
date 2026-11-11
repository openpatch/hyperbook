import { describe, expect, it } from "vitest";
import { ZOOM_STEPS, nextZoom } from "../src/web/pages/editor/pdf-view";

describe("PDF zoom", () => {
  it("steps in and out from any zoom, also a fitted one between steps", () => {
    expect(nextZoom(1, 1)).toBe(1.1);
    expect(nextZoom(1, -1)).toBe(0.9);
    expect(nextZoom(0.82, 1)).toBe(0.9);
    expect(nextZoom(0.82, -1)).toBe(0.75);
  });

  it("stays at the ends", () => {
    expect(nextZoom(ZOOM_STEPS.at(-1)!, 1)).toBe(ZOOM_STEPS.at(-1));
    expect(nextZoom(ZOOM_STEPS[0]!, -1)).toBe(ZOOM_STEPS[0]);
  });
});
