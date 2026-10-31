import path from "path";
import fs from "fs/promises";
import { Jimp, type JimpInstance } from "jimp";
import { HyperbookJson } from "@hyperbook/types";
import { makeDir } from "./make-dir";

/*
 * Favicons from the book's logo, without a native addon. The sandbox of a
 * Hyperbook Cloud build (Node's permission model) allows no native addons,
 * which used to leave `sharp` — and with it favicon generation — outside;
 * the image also ships the CLI's directory only, so nothing beside the
 * bundle can be required either. Jimp, pure JavaScript, decodes and scales
 * raster logos; an SVG logo is rasterized by resvg compiled to WebAssembly,
 * which no permission model gates. What comes out is exactly what pages
 * reference (markdown's rehypeHtmlStructure): favicon.ico in the book's
 * root, and the favicons folder of the book's assets with
 * apple-touch-icon.png and manifest.webmanifest.
 */

/** The frames of favicon.ico; PNG-in-ICO is understood since Windows Vista. */
const ICO_SIZES = [16, 32, 48];

/** The icons the manifest points at; 192 and 512 are what stores expect. */
const MANIFEST_ICONS = [192, 512];

/** Apple's touch icon: square and opaque, iOS rounds its corners itself. */
const APPLE_TOUCH_ICON = 180;

/** An SVG logo is rasterized once at this width, then scaled like a raster. */
const SVG_RENDER_WIDTH = 1024;

/** White behind the opaque icons; the logo's own transparency stays on top. */
const BACKGROUND = 0xffffffff;

export async function generateFavicons(
  logoPath: string,
  outputDir: string,
  hyperbookConfig: HyperbookJson,
  assetsFolder: string,
): Promise<void> {
  const logo = await readLogo(logoPath);
  const faviconsDir = path.join(outputDir, assetsFolder, "favicons");
  await makeDir(faviconsDir, { recursive: true });

  // The book root's icon: transparent frames, the logo fitted into each.
  const frames = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      png: await encode(square(logo, size, false)),
    })),
  );
  await fs.writeFile(path.join(outputDir, "favicon.ico"), ico(frames));

  await fs.writeFile(
    path.join(faviconsDir, "apple-touch-icon.png"),
    await encode(square(logo, APPLE_TOUCH_ICON, true)),
  );

  // The pages link the manifest, and the manifest points at its own icons.
  const manifestPath = path.posix.join(
    hyperbookConfig.basePath || "/",
    assetsFolder,
    "favicons",
  );
  const manifest = {
    name: hyperbookConfig.name,
    short_name: hyperbookConfig.name,
    description: hyperbookConfig.description || hyperbookConfig.name,
    lang: hyperbookConfig.language || "en",
    dir: "auto",
    start_url: hyperbookConfig.basePath || "/",
    scope: hyperbookConfig.basePath || "/",
    display: "standalone",
    orientation: "any",
    theme_color: hyperbookConfig.colors?.brand || "#007864",
    background_color: "#ffffff",
    icons: await Promise.all(
      MANIFEST_ICONS.map(async (size) => {
        const name = `icon-${size}x${size}.png`;
        await fs.writeFile(
          path.join(faviconsDir, name),
          await encode(square(logo, size, true)),
        );
        return {
          src: `${manifestPath}/${name}`,
          sizes: `${size}x${size}`,
          type: "image/png",
        };
      }),
    ),
  };
  await fs.writeFile(
    path.join(faviconsDir, "manifest.webmanifest"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

/**
 * The logo as an image: rasterized first when it is an SVG. Jimp declares
 * its instance type inline in several places that do not unify, so the
 * result of read is nudged onto the constructor's own.
 */
async function readLogo(logoPath: string): Promise<JimpInstance> {
  const image = logoPath.toLowerCase().endsWith(".svg")
    ? await Jimp.read(await rasterizeSvg(await fs.readFile(logoPath, "utf8")))
    : await Jimp.read(logoPath);
  return image as unknown as JimpInstance;
}

let resvg: Promise<void> | undefined;

/** Rasterize an SVG at a generous width; smaller sizes are scaled down. */
async function rasterizeSvg(svg: string): Promise<Buffer> {
  const { initWasm, Resvg } = await import("@resvg/resvg-wasm");
  // initWasm may run once per process; a failed load is retried next time.
  if (!resvg) {
    resvg = initWasm(await wasmBytes()).catch((error) => {
      resvg = undefined;
      throw error;
    });
  }
  await resvg;
  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: SVG_RENDER_WIDTH },
  });
  return Buffer.from(renderer.render().asPng());
}

/** The resvg binary: beside the bundled CLI, or an ordinary dependency. */
async function wasmBytes(): Promise<Buffer> {
  // The build copies it next to the CLI (see postbuild.mjs): the sandbox of
  // a Hyperbook Cloud build allows reads of the CLI's directory, and dist is
  // all the npm package ships.
  const beside = path.join(__dirname, "resvg.wasm");
  if (await exists(beside)) return fs.readFile(beside);
  // From source (tests, development) it lives in node_modules like any
  // dependency; walk up from this package's root.
  const packagePath =
    path.basename(__dirname) === "helpers"
      ? path.dirname(__dirname)
      : __dirname;
  for (let dir = packagePath; ; dir = path.dirname(dir)) {
    const found = await findWasm(
      path.join(dir, "node_modules", "@resvg", "resvg-wasm"),
    );
    if (found) return fs.readFile(found);
    if (path.dirname(dir) === dir) break;
  }
  throw new Error("Could not find the resvg WebAssembly binary (resvg.wasm).");
}

async function findWasm(dir: string): Promise<string | null> {
  let found: string | null = null;
  const walk = async (current: string): Promise<void> => {
    for (const entry of await fs
      .readdir(current, { withFileTypes: true })
      .catch(() => [])) {
      if (found) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".wasm")) found = full;
    }
  };
  await walk(dir);
  return found;
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

/**
 * The logo scaled into a size×size square: fitted, never stretched, and
 * centered — on white for the icons an operating system composites itself,
 * on transparency for the favicon. Small sizes are reached by halving,
 * which keeps a large logo's edges from aliasing in one big step.
 */
function square(
  logo: JimpInstance,
  size: number,
  opaque: boolean,
): JimpInstance {
  const scale = size / Math.max(logo.width, logo.height);
  const w = Math.max(1, Math.round(logo.width * scale));
  const h = Math.max(1, Math.round(logo.height * scale));
  let scaled = logo.clone();
  while (scaled.width >= w * 2 && scaled.height >= h * 2) {
    scaled = resample(scaled, {
      w: Math.ceil(scaled.width / 2),
      h: Math.ceil(scaled.height / 2),
    });
  }
  scaled = resample(scaled, { w, h });
  const canvas = new Jimp({
    width: size,
    height: size,
    color: opaque ? BACKGROUND : 0x00000000,
  });
  canvas.composite(scaled, (size - w) >> 1, (size - h) >> 1);
  return canvas;
}

async function encode(image: JimpInstance): Promise<Buffer> {
  return image.getBuffer("image/png");
}

/**
 * Jimp's chained methods return a type its own instance type is not
 * assignable to — the declarations do not unify — so the result is nudged
 * back onto the instance type.
 */
function resample(image: JimpInstance, size: { w: number; h: number }) {
  return image.resize(size) as unknown as JimpInstance;
}

/** An ICO holding PNG-encoded frames, as every browser expects them. */
function ico(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1: icon
  header.writeUInt16LE(frames.length, 4);
  const entries = Buffer.alloc(16 * frames.length);
  const blobs: Buffer[] = [];
  let offset = header.length + entries.length;
  frames.forEach(({ size, png }, i) => {
    const entry = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, entry); // width; 0 means 256
    entries.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    entries.writeUInt8(0, entry + 2); // colors: not a palette
    entries.writeUInt8(0, entry + 3); // reserved
    entries.writeUInt16LE(1, entry + 4); // color planes
    entries.writeUInt16LE(32, entry + 6); // bits per pixel
    entries.writeUInt32LE(png.length, entry + 8);
    entries.writeUInt32LE(offset, entry + 12);
    blobs.push(png);
    offset += png.length;
  });
  return Buffer.concat([header, entries, ...blobs]);
}
