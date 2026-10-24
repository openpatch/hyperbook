import { describe, expect, it } from "vitest";
// @ts-expect-error The browser bundle is JavaScript.
import { compareImages, isSolved } from "../ide-bundle/compare.js";

/** A width×height RGBA image filled by a function of the pixel. */
const image = (
  width: number,
  height: number,
  color: (x: number, y: number) => [number, number, number, number],
) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(color(x, y), (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

const white = (): [number, number, number, number] => [255, 255, 255, 255];
/** A black square from (4,4) to (11,11) on white. */
const square = (offset = 0) => (x: number, y: number) =>
  x >= 4 + offset && x < 12 + offset && y >= 4 && y < 12
    ? ([0, 0, 0, 255] as [number, number, number, number])
    : white();

describe("compareImages", () => {
  it("scores identical images 100", () => {
    const a = image(16, 16, square());
    expect(compareImages(a, image(16, 16, square())).score).toBe(100);
  });

  it("gives a missing drawing only what its background matches", () => {
    const result = compareImages(image(16, 16, square()), image(16, 16, white));
    expect(result.drawn).toBe(64);
    expect(result.mismatched).toBe(64);
    // The background is three quarters of the picture; outline and area are
    // missing.
    expect(result.parts).toEqual({ colour: 75, outline: 0, area: 0 });
    expect(result.score).toBe(37.5);
  });

  it("gives a thin line in the wrong place nothing for outline and area", () => {
    const line = (row: number) => (x: number, y: number) =>
      y === row && x >= 10 && x < 90
        ? ([0, 0, 0, 255] as [number, number, number, number])
        : white();
    // A line in the wrong place shares no pixels with the target; only the
    // background matches.
    const result = compareImages(image(100, 100, line(20)), image(100, 100, line(60)));
    expect(result.parts.outline).toBe(0);
    expect(result.parts.area).toBe(0);
    expect(result.score).toBeLessThan(50);
  });

  it("forgives a drawing one pixel off", () => {
    const result = compareImages(image(16, 16, square()), image(16, 16, square(1)));
    expect(result.score).toBe(100);
  });

  it("does not forgive a drawing further off", () => {
    const result = compareImages(image(16, 16, square()), image(16, 16, square(3)));
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(90);
  });

  it("scores two empty canvases 100", () => {
    expect(compareImages(image(8, 8, white), image(8, 8, white)).score).toBe(100);
  });

  it("marks mismatches red in the difference image", () => {
    const { diff } = compareImages(image(16, 16, square()), image(16, 16, white));
    const at = (x: number, y: number) =>
      Array.from(diff.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
    expect(at(5, 5)).toEqual([230, 40, 60, 255]);
    expect(at(0, 0)[0]).toBe(at(0, 0)[1]); // unmarked pixels are gray
  });

  it("treats transparent as white, as the drawing is shown on white", () => {
    const transparent = image(4, 4, () => [0, 0, 0, 0]);
    expect(compareImages(transparent, image(4, 4, white)).score).toBe(100);
  });

  it("forgives colours that are almost the same", () => {
    const a = image(8, 8, () => [100, 150, 200, 255]);
    const b = image(8, 8, () => [102, 151, 198, 255]);
    expect(compareImages(a, b).score).toBe(100);
  });

  it("does not count anti-aliased edge pixels", () => {
    // The same square, but the edge column of one is drawn half-covered.
    const crisp = image(16, 16, square());
    const soft = image(16, 16, (x, y) =>
      x === 12 && y >= 4 && y < 12 ? [128, 128, 128, 255] : square()(x, y),
    );
    expect(compareImages(crisp, soft).score).toBe(100);
  });

  it("scores an empty canvas about half against two small dots", () => {
    const dots = image(100, 100, (x, y) =>
      (x === 20 && y === 20) || (x === 70 && y === 60)
        ? [0, 0, 0, 255]
        : white(),
    );
    // All of the colour (the dots are tiny), nothing of outline and area.
    const { parts, score } = compareImages(dots, image(100, 100, white));
    expect(parts.outline).toBe(0);
    expect(parts.area).toBe(0);
    expect(score).toBeGreaterThan(49);
    expect(score).toBeLessThanOrEqual(50);
  });

  it("gives a shape in a slightly wrong colour most, but not all, of its colour", () => {
    // The docs' Web IDE task: a light green circle on brown, drawn in a
    // light orange (#f5e0ba instead of #b5e0ba).
    const circle = (color: [number, number, number]) => (x: number, y: number) =>
      (x - 50) ** 2 + (y - 40) ** 2 < 25 ** 2
        ? ([...color, 255] as [number, number, number, number])
        : ([0x5d, 0x3a, 0x3a, 255] as [number, number, number, number]);
    const { parts } = compareImages(
      image(100, 80, circle([0xb5, 0xe0, 0xba])),
      image(100, 80, circle([0xf5, 0xe0, 0xba])),
    );
    expect(parts.colour).toBeGreaterThan(90);
    expect(parts.colour).toBeLessThan(98);
    expect(parts.outline).toBe(100);
    expect(parts.area).toBe(100);
  });

  it("scores a very different colour nothing for colour, but keeps the shape", () => {
    const black = image(16, 16, square());
    const red = image(16, 16, (x, y) =>
      x >= 4 && x < 12 && y >= 4 && y < 12 ? [255, 0, 0, 255] : white(),
    );
    // The square is a quarter of the picture; the background matches.
    const { parts, score } = compareImages(black, red);
    expect(parts.colour).toBe(75);
    expect(parts.outline).toBe(100);
    expect(parts.area).toBe(100);
    expect(score).toBe(87.5);
  });

  it("counts a wrong background everywhere", () => {
    const target = image(16, 16, square());
    const gray = image(16, 16, (x, y) =>
      x >= 4 && x < 12 && y >= 4 && y < 12 ? [0, 0, 0, 255] : [120, 120, 120, 255],
    );
    const { drawn } = compareImages(target, gray);
    expect(drawn).toBe(256);
  });

  it("finds the background along the edge, even with a drawn corner", () => {
    // The target's drawing touches its top left corner.
    const corner = (x: number, y: number) =>
      x < 3 && y < 3 ? ([0, 0, 0, 255] as [number, number, number, number]) : white();
    const result = compareImages(image(16, 16, corner), image(16, 16, corner));
    expect(result.drawn).toBe(9);
    expect(result.score).toBe(100);
  });

  it("marks a slightly wrong colour fainter than a missing shape", () => {
    const target = image(16, 16, square());
    const dark = image(16, 16, (x, y) =>
      x >= 4 && x < 12 && y >= 4 && y < 12 ? [60, 60, 60, 255] : white(),
    );
    const faint = compareImages(target, dark).diff[(5 * 16 + 5) * 4 + 1];
    const strong = compareImages(target, image(16, 16, white)).diff[(5 * 16 + 5) * 4 + 1];
    // Less green means a stronger red.
    expect(strong).toBeLessThan(faint);
  });

  describe("in three parts: colour, outline and area", () => {
    const brown: [number, number, number, number] = [0x5d, 0x3a, 0x3a, 255];
    const green: [number, number, number, number] = [0xb5, 0xe0, 0xba, 255];
    const circle = (cx = 50, r = 25) => (x: number, y: number) =>
      (x - cx) ** 2 + (y - 40) ** 2 < r ** 2 ? green : brown;
    const target = image(100, 80, circle());

    it("lowers outline and area for the wrong shape, not the colour", () => {
      const square = image(100, 80, (x, y) =>
        x >= 25 && x < 75 && y >= 15 && y < 65 ? green : brown,
      );
      const { parts, score } = compareImages(target, square);
      expect(parts.outline).toBeLessThan(60);
      expect(score).toBeLessThan(parts.colour);
      expect(score).toBeLessThan(85);
    });

    it("forgives a pixel off, and keeps a little more close to solved", () => {
      expect(compareImages(target, image(100, 80, circle(51))).score).toBe(100);
      const { score } = compareImages(target, image(100, 80, circle(52)));
      expect(score).toBeGreaterThan(85);
      expect(score).toBeLessThan(100);
    });

    it("gives less for further off", () => {
      const near = compareImages(target, image(100, 80, circle(53))).score;
      const far = compareImages(target, image(100, 80, circle(60))).score;
      expect(far).toBeLessThan(near);
    });

    it("scores all parts 100 for the same picture, and no outline or area for nothing drawn", () => {
      expect(compareImages(target, image(100, 80, circle())).parts).toEqual({
        colour: 100,
        outline: 100,
        area: 100,
      });
      const empty = compareImages(target, image(100, 80, () => brown)).parts;
      expect(empty.outline).toBe(0);
      expect(empty.area).toBe(0);
    });
  });

  it("solves only with every part at the pass score", () => {
    // The docs' task in a slightly wrong colour: 98 in total, not in colour.
    const wrongColour = { colour: 97, outline: 100, area: 100 };
    expect(isSolved(98.4, wrongColour, 98)).toBe(false);
    expect(isSolved(98.4, wrongColour, 95)).toBe(true);
    expect(isSolved(99, { colour: 99, outline: 99, area: 99 }, 98)).toBe(true);
    expect(isSolved(97, { colour: 99, outline: 99, area: 92 }, 95)).toBe(false);
  });

  it("rejects images of different sizes", () => {
    expect(() =>
      compareImages(image(4, 4, white), image(5, 4, white)),
    ).toThrow("same size");
  });
});

describe("extractPalette", () => {
  // @ts-expect-error The browser bundle is JavaScript.
  const load = () => import("../ide-bundle/compare.js");

  it("lists the colour of a thin line on a large canvas", async () => {
    const { extractPalette } = await load();
    const img = image(200, 200, (x, y) =>
      y === 100 && x >= 50 && x < 150 ? [0, 0, 0, 255] : [255, 255, 255, 255],
    );
    expect(extractPalette(img).map((p: { color: string }) => p.color)).toEqual([
      "#ffffff",
      "#000000",
    ]);
  });

  it("lists the colours most used first, as hex", async () => {
    const { extractPalette } = await load();
    const img = image(10, 10, (x) =>
      x < 7 ? [93, 58, 58, 255] : [181, 224, 186, 255],
    );
    expect(extractPalette(img)).toEqual([
      { color: "#5d3a3a", share: 0.7 },
      { color: "#b5e0ba", share: 0.3 },
    ]);
  });

  it("leaves out the rare in-between colours of anti-aliased edges", async () => {
    const { extractPalette } = await load();
    const img = image(100, 100, (x, y) =>
      x === 50 && y === 0 ? [140, 140, 140, 255] : [0, 0, 0, 255],
    );
    expect(extractPalette(img).map((p: { color: string }) => p.color)).toEqual([
      "#000000",
    ]);
  });

  it("merges colours that are nearly the same, and ignores transparency", async () => {
    const { extractPalette } = await load();
    const img = image(10, 10, (x, y) =>
      y < 5 ? [200, 50, 50, 255] : x < 5 ? [203, 52, 49, 255] : [0, 0, 0, 0],
    );
    expect(extractPalette(img).map((p: { color: string }) => p.color)).toEqual([
      "#c83232",
    ]);
  });
});
