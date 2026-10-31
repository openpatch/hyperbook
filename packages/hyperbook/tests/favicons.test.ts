import os from "os";
import path from "path";
import fs from "fs/promises";
import { beforeEach, expect, it } from "vitest";
import { Jimp } from "jimp";
import { generateFavicons } from "../helpers/generate-favicons";
import type { HyperbookJson } from "@hyperbook/types";

/*
 * The pure-JS pipeline (Jimp, resvg's WebAssembly) runs where the old
 * sharp-based one could not: inside the build sandbox of Hyperbook Cloud,
 * which allows no native addons. These tests cover the outputs pages
 * reference (markdown's rehypeHtmlStructure): favicon.ico in the book's
 * root, and apple-touch-icon.png and manifest.webmanifest with the
 * manifest's icons in the favicons folder of the book's assets.
 */

const RED = 0xff0000ff;
const GREEN = 0x008000ff;

let root: string;
const config: HyperbookJson = {
  name: "Test Book",
  description: "A book for tests",
  language: "de",
  colors: { brand: "#123456" },
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-favicons-"));
});

/** A solid PNG logo of the given size. */
async function pngLogo(width: number, height: number, color: number) {
  const logo = path.join(root, `logo-${width}x${height}.png`);
  const image = new Jimp({ width, height, color });
  await image.write(logo as `${string}.png`);
  return logo;
}

/** The frames of an ICO: {size, png} from its directory entries. */
function icoFrames(buffer: Buffer) {
  expect(buffer.readUInt16LE(0)).toBe(0); // reserved
  expect(buffer.readUInt16LE(2)).toBe(1); // type: icon
  const frames = [] as { size: number; png: Buffer }[];
  for (let i = 0; i < buffer.readUInt16LE(4); i++) {
    const entry = 6 + 16 * i;
    const size = buffer.readUInt8(entry);
    const png = buffer.subarray(
      buffer.readUInt32LE(entry + 12),
      buffer.readUInt32LE(entry + 12) + buffer.readUInt32LE(entry + 8),
    );
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    frames.push({ size, png });
  }
  return frames;
}

it("generates favicon.ico, apple-touch-icon and the manifest from a PNG logo", async () => {
  // 64×48: not square, so the apple-touch-icon keeps white borders while
  // the logo covers the center — both are asserted below.
  await generateFavicons(
    await pngLogo(64, 48, RED),
    root,
    config,
    "__hyperbook_assets",
  );

  // favicon.ico in the book's root, with 16/32/48 frames that decode.
  const frames = icoFrames(await fs.readFile(path.join(root, "favicon.ico")));
  expect(frames.map((f) => f.size)).toEqual([16, 32, 48]);
  for (const { size, png } of frames)
    await expect(Jimp.read(png)).resolves.toMatchObject({
      width: size,
      height: size,
    });

  // apple-touch-icon.png: 180×180 and opaque, the logo centered on white.
  const apple = await Jimp.read(
    path.join(root, "__hyperbook_assets", "favicons", "apple-touch-icon.png"),
  );
  expect(apple).toMatchObject({ width: 180, height: 180 });
  expect(apple.getPixelColor(0, 0)).toBe(0xffffffff);
  expect(apple.getPixelColor(90, 90)).toBe(RED);

  // The manifest points at icons that exist, with the book's metadata.
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(root, "__hyperbook_assets", "favicons", "manifest.webmanifest"),
      "utf8",
    ),
  );
  expect(manifest).toMatchObject({
    name: "Test Book",
    lang: "de",
    theme_color: "#123456",
    display: "standalone",
  });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    "192x192",
    "512x512",
  ]);
  for (const icon of manifest.icons) {
    const file = path.join(root, icon.src);
    const image = await Jimp.read(file);
    expect(image.width).toBe(Number(icon.sizes.split("x")[0]));
  }
});

it("fits a wide logo into the square without stretching it", async () => {
  await generateFavicons(
    await pngLogo(64, 16, RED),
    root,
    config,
    "__hyperbook_assets",
  );

  // 64×16 scaled into 180×180 becomes 180 wide and 45 high, centered.
  const apple = await Jimp.read(
    path.join(root, "__hyperbook_assets", "favicons", "apple-touch-icon.png"),
  );
  expect(apple.getPixelColor(90, 90)).toBe(RED); // in the logo
  expect(apple.getPixelColor(90, 20)).toBe(0xffffffff); // above it
});

it("rasterizes an SVG logo", async () => {
  const logo = path.join(root, "logo.svg");
  await fs.writeFile(
    logo,
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<rect width="64" height="64" fill="#008000"/></svg>',
  );
  await generateFavicons(logo, root, config, "__hyperbook_assets");

  expect(
    icoFrames(await fs.readFile(path.join(root, "favicon.ico"))),
  ).not.toHaveLength(0);
  const apple = await Jimp.read(
    path.join(root, "__hyperbook_assets", "favicons", "apple-touch-icon.png"),
  );
  expect(apple).toMatchObject({ width: 180, height: 180 });
  expect(apple.getPixelColor(90, 90)).toBe(GREEN);
});
