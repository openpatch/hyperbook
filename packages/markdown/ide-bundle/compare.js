/**
 * Graphic comparison: how close a reader's drawing is to the solution's.
 *
 * Both images are rendered in the reader's browser by the same runtime, so a
 * correct solution matches exactly; only real differences count. A pixel
 * that differs only by anti-aliasing (an edge drawn a little differently)
 * is not counted as a mismatch, following pixelmatch's approach.
 */


import { icon } from "./icons.js";

const t = (key, values) => hyperbook.i18n.get(key, values);

// --- comparing ---------------------------------------------------------------

/** A colour blended over white, as YIQ, for a perceptual difference. */
const yiq = (data, i) => {
  const a = data[i + 3] / 255;
  const r = 255 + (data[i] - 255) * a;
  const g = 255 + (data[i + 1] - 255) * a;
  const b = 255 + (data[i + 2] - 255) * a;
  return [
    r * 0.29889531 + g * 0.58662247 + b * 0.11448223,
    r * 0.59597799 - g * 0.2741761 - b * 0.32180189,
    r * 0.21147017 - g * 0.52261711 + b * 0.31114694,
  ];
};

/** The squared YIQ distance of two pixels, 0 … 35215. */
const distance = (a, i, b, j) => {
  const [y1, i1, q1] = yiq(a, i);
  const [y2, i2, q2] = yiq(b, j);
  const dy = y1 - y2, di = i1 - i2, dq = q1 - q2;
  return 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
};

const brightness = (data, i) => yiq(data, i)[0];

/**
 * Whether the pixel at (x, y) of `img` looks like anti-aliasing: it lies
 * between a darkest and a brightest neighbour, and one of those sits in a
 * flat area in both images. (pixelmatch's test, simplified.)
 */
const antialiased = (img, x, y, width, height, other) => {
  let zeroes = x === 0 || x === width - 1 || y === 0 || y === height - 1 ? 1 : 0;
  let min = 0, max = 0, minX, minY, maxX, maxY;
  const center = brightness(img, (y * width + x) * 4);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const delta = center - brightness(img, (ny * width + nx) * 4);
      if (delta === 0) {
        zeroes++;
        if (zeroes > 2) return false;
      } else if (delta < min) {
        min = delta; minX = nx; minY = ny;
      } else if (delta > max) {
        max = delta; maxX = nx; maxY = ny;
      }
    }
  }
  if (min === 0 || max === 0) return false;
  const flat = (data, fx, fy) => {
    const c = (fy * width + fx) * 4;
    let same = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = fx + dx, ny = fy + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height) {
          const n = (ny * width + nx) * 4;
          if (
            data[c] === data[n] && data[c + 1] === data[n + 1] &&
            data[c + 2] === data[n + 2] && data[c + 3] === data[n + 3]
          ) {
            same++;
          }
        }
      }
    }
    return same >= 3;
  };
  return (
    (flat(img, minX, minY) && flat(other, minX, minY)) ||
    (flat(img, maxX, maxY) && flat(other, maxX, maxY))
  );
};

/** Whether a pixel of `img` is within `maxDelta` of the colour at `i`. */
const near = (img, x, y, width, height, ref, i, maxDelta) => {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (distance(img, (ny * width + nx) * 4, ref, i) <= maxDelta) return true;
    }
  }
  return false;
};

/** The largest squared YIQ distance two colours can have (black, white). */
const MAX_DISTANCE = 35215;

/**
 * The background of a picture: the colour most of its edge has. A single
 * corner would be wrong as soon as the drawing touches it.
 */
const backgroundOf = (image) => {
  const { data, width, height } = image;
  const counts = new Map();
  const count = (x, y) => {
    const i = (y * width + x) * 4;
    // Transparent counts as the white it is shown on.
    const key = data[i + 3] === 0 ? -1 : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < width; x++) {
    count(x, 0);
    if (height > 1) count(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    count(0, y);
    if (width > 1) count(width - 1, y);
  }
  let best = -1;
  let most = -1;
  for (const [key, n] of counts) {
    if (n > most) {
      most = n;
      best = key;
    }
  }
  return best === -1
    ? new Uint8ClampedArray([255, 255, 255, 0])
    : new Uint8ClampedArray([(best >> 16) & 255, (best >> 8) & 255, best & 255, 255]);
};

/**
 * How far each pixel is from the nearest marked one, in pixels, up to `cap`
 * (a two-pass chamfer distance: 1 across, 1.4 diagonally).
 *
 * @param {Uint8Array} marks 1 where marked.
 */
const distances = (marks, width, height, cap) => {
  const dist = new Float32Array(width * height).fill(cap);
  for (let i = 0; i < marks.length; i++) if (marks[i]) dist[i] = 0;
  const relax = (i, j, step) => {
    if (dist[j] + step < dist[i]) dist[i] = dist[j] + step;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) relax(i, i - 1, 1);
      if (y > 0) {
        relax(i, i - width, 1);
        if (x > 0) relax(i, i - width - 1, 1.4);
        if (x < width - 1) relax(i, i - width + 1, 1.4);
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) relax(i, i + 1, 1);
      if (y < height - 1) {
        relax(i, i + width, 1);
        if (x < width - 1) relax(i, i + width + 1, 1.4);
        if (x > 0) relax(i, i + width - 1, 1.4);
      }
    }
  }
  return dist;
};

/**
 * How well two sets of marked pixels agree, 0 … 1: each mark scores by how
 * close the other image has one (full within `full` pixels, nothing from
 * `none` on), both ways, as F1 of the two. A missing shape lowers the first
 * direction, an extra one the second.
 */
const agreement = (a, b, width, height, full, none) => {
  let countA = 0;
  let countB = 0;
  for (let i = 0; i < a.length; i++) {
    countA += a[i];
    countB += b[i];
  }
  if (countA === 0 && countB === 0) return 1;
  if (countA === 0 || countB === 0) return 0;
  // Distances are stored as 32-bit floats: at the cap counts as too far.
  const cap = Math.fround(none);
  const credit = (d) =>
    d <= full ? 1 : d >= cap ? 0 : Math.max(0, 1 - (d - full) / (none - full));
  const toB = distances(b, width, height, none);
  const toA = distances(a, width, height, none);
  let recall = 0;
  let precision = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i]) recall += credit(toB[i]);
    if (b[i]) precision += credit(toA[i]);
  }
  recall /= countA;
  precision /= countB;
  return recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);
};

/**
 * Whether a comparison solves the task: the score and each of its parts at
 * the pass score. With the background counted, a shape in the wrong colour
 * can reach it in total, but not in colour.
 *
 * @param {number} score
 * @param {{ colour: number, outline: number, area: number }} parts
 * @param {number} pass
 */
export const isSolved = (score, parts, pass) =>
  score >= pass && Object.values(parts).every((part) => part >= pass);

/** The weights of colour, outline and area in the score. */
const WEIGHTS = { colour: 0.5, outline: 0.3, area: 0.2 };

/**
 * Compares two images of the same size, in three parts:
 *
 * - colour (half the score): how alike the pixels are, all of them, the
 *   background too. A pixel matches fully if its colour is within
 *   `threshold`, if the other image has its colour a pixel away (a line drawn
 *   a hair off), or if it is an anti-aliased edge; otherwise it scores by how
 *   close its colour is.
 * - outline (30 %): whether the edges of shapes are where the target has
 *   them: full within 2 pixels, falling off over about 5 % of the drawing's
 *   size.
 * - area (20 %): whether the drawn areas cover each other, whatever their
 *   colour: full within a pixel, falling off over about 3 % of its size.
 *
 * Outline and area look only at the drawing: what differs from the target's
 * background. So a shape in a slightly wrong colour keeps them, a shape of
 * the wrong form or place loses them, and an empty canvas gets nothing for
 * them: against two dots on white, a white canvas scores about 50.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} target
 * @param {{data: Uint8ClampedArray, width: number, height: number}} output
 * @param {{ threshold?: number, zero?: number }} [options] `threshold`, 0 … 1:
 *   how different two colours may be and still match fully. `zero`, 0 … 1:
 *   from how different on they score nothing.
 * @returns {{ score: number, parts: { colour: number, outline: number, area: number }, mismatched: number, drawn: number, diff: Uint8ClampedArray }}
 *   The score and its parts in percent, the pixels drawn in either image and
 *   those whose colour does not fully match, and an RGBA image marking mismatches red,
 *   the stronger the further off.
 */
export const compareImages = (target, output, { threshold = 0.1, zero = 0.4 } = {}) => {
  const { width, height } = target;
  if (output.width !== width || output.height !== height) {
    throw new Error("Images to compare must have the same size");
  }
  const maxDelta = MAX_DISTANCE * threshold * threshold;
  const full = Math.sqrt(maxDelta);
  const none = Math.sqrt(MAX_DISTANCE) * zero;
  /** How alike two colours at a squared distance are: 1 … 0. */
  const similarity = (d) =>
    d <= maxDelta ? 1 : Math.max(0, 1 - (Math.sqrt(d) - full) / (none - full));

  const a = target.data;
  const b = output.data;
  const background = backgroundOf(target);
  const size = width * height;
  const diff = new Uint8ClampedArray(size * 4);
  /** What is drawn, in each image: not the target's background. */
  const areaA = new Uint8Array(size);
  const areaB = new Uint8Array(size);
  /** Edges: where a pixel's colour differs from its right or lower one. */
  const edgesA = new Uint8Array(size);
  const edgesB = new Uint8Array(size);
  let drawn = 0;
  let mismatched = 0;
  let matched = 0;
  // The box around what is drawn in either image, for how far off counts.
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      // A faded copy of the target, so the marks have a context.
      const gray = 255 - (255 - brightness(a, i)) * 0.25;
      diff[i] = diff[i + 1] = diff[i + 2] = gray;
      diff[i + 3] = 255;

      for (const [img, edges] of [[a, edgesA], [b, edgesB]]) {
        if (
          (x + 1 < width && distance(img, i, img, i + 4) > maxDelta) ||
          (y + 1 < height && distance(img, i, img, i + width * 4) > maxDelta)
        ) {
          edges[p] = 1;
        }
      }

      const inTarget = distance(a, i, background, 0) > maxDelta;
      const inOutput = distance(b, i, background, 0) > maxDelta;
      areaA[p] = inTarget ? 1 : 0;
      areaB[p] = inOutput ? 1 : 0;
      if (inTarget || inOutput) {
        drawn++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const d = distance(a, i, b, i);
      if (
        d <= maxDelta ||
        antialiased(a, x, y, width, height, b) ||
        antialiased(b, x, y, width, height, a) ||
        (near(b, x, y, width, height, a, i, maxDelta) &&
          near(a, x, y, width, height, b, i, maxDelta))
      ) {
        matched++;
        continue;
      }
      const alike = similarity(d);
      matched += alike;
      mismatched++;
      // Red, as strong as the pixel is off.
      const off = 1 - alike;
      diff[i] = gray + (230 - gray) * off;
      diff[i + 1] = gray + (40 - gray) * off;
      diff[i + 2] = gray + (60 - gray) * off;
    }
  }
  // How far off still earns something grows with the drawing: a few pixels
  // matter more in a small one.
  const diagonal = maxX < 0 ? 0 : Math.hypot(maxX - minX + 1, maxY - minY + 1);
  const reach = (share, min, max) => Math.min(max, Math.max(min, diagonal * share));
  const parts = {
    // Every pixel, the background too.
    colour: (100 * matched) / size,
    outline: 100 * agreement(edgesA, edgesB, width, height, 2, reach(0.05, 4, 20)),
    area: 100 * agreement(areaA, areaB, width, height, 1, reach(0.03, 3, 10)),
  };
  const score =
    WEIGHTS.colour * parts.colour +
    WEIGHTS.outline * parts.outline +
    WEIGHTS.area * parts.area;
  return { score, parts, mismatched, drawn, diff };
};

/**
 * Draws a captured image onto a white canvas of the comparison's size, at
 * its own size and from the top left, so a drawing of the wrong size shows
 * as a difference instead of being scaled to fit.
 *
 * @param {CanvasImageSource} source
 * @param {number} sourceWidth Logical width (CSS pixels) of the source.
 * @param {number} sourceHeight
 * @param {number} width The comparison's size.
 * @param {number} height
 */
export const normalize = (
  source,
  sourceWidth,
  sourceHeight,
  width,
  height,
  { centered = false } = {},
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  // The turtle draws around the middle, p5 from the top left.
  const x = centered ? Math.round((width - sourceWidth) / 2) : 0;
  const y = centered ? Math.round((height - sourceHeight) / 2) : 0;
  ctx.drawImage(source, x, y, sourceWidth, sourceHeight);
  return canvas;
};

const hex = (r, g, b) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/**
 * The colours a target is made of, most used first, as on CSSBattle.
 *
 * Counts exact colours of opaque pixels. Anti-aliased edges blend two colours
 * into many rare ones, so a colour has to cover a share of the drawing to be
 * listed, and colours very close to one already listed are left out.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {{ max?: number, minShare?: number }} [options]
 * @returns {{ color: string, share: number }[]}
 */
export const extractPalette = (
  image,
  { max = 8, minShare = 0.02, minPixels = 20 } = {},
) => {
  const counts = new Map();
  const { data } = image;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    opaque++;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const palette = [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  // The background is listed anyway; the others are measured against the
  // drawing, or a thin line on a large canvas would never count.
  const drawing = Math.max(1, opaque - (sorted[0]?.[1] ?? 0));
  for (const [key, count] of sorted) {
    if (palette.length >= max) break;
    const first = palette.length === 0;
    if (!first && (count < minPixels || count / drawing < minShare)) continue;
    const rgb = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
    const close = palette.some(
      ({ rgb: other }) =>
        Math.abs(other[0] - rgb[0]) + Math.abs(other[1] - rgb[1]) + Math.abs(other[2] - rgb[2]) < 12,
    );
    if (close) continue;
    palette.push({ rgb, color: hex(...rgb), share: count / opaque });
  }
  return palette.map(({ color, share }) => ({ color, share }));
};

/** Loads an image file of the workspace (role="target") onto a canvas. */
export const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });

// --- the view ----------------------------------------------------------------

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Graphic comparison for one IDE, on the reader's own output: the target lies
 * over the output, at the same size and place.
 *
 * - Split: a line divides them, as on CSSBattle: the reader's drawing left of
 *   it ("Yours"), the target right of it ("Target"). It starts at the left
 *   edge, all target, as the target is the task; the first time the output
 *   changes it moves to the middle, so the reader sees their result. The line
 *   is dragged by its grip, or moved with the slider below.
 * - Overlay: the target half see-through over the whole drawing.
 * - Differences: what did not match, after the last score.
 * - Holding "Target" shows all of the target for a moment.
 *
 * The drawing is scored whenever the IDE says its output changed; there is
 * no button. A panel underneath shows the score (its parts on hover) and
 * the target's colours. Once solved, the
 * picture is outlined and says so.
 *
 * @param {{
 *   ide: ReturnType<typeof import("./index.js").mount>,
 *   pass: number,
 *   hint?: string,
 *   overlay: HTMLElement,
 *   panelAfter: HTMLElement,
 *   align?: "start" | "center",
 *   locate?: () => ({ x: number, y: number } | null),
 *   drawTarget: () => Promise<HTMLCanvasElement>,
 *   drawOutput: () => Promise<HTMLCanvasElement | null>,
 *   observe?: HTMLElement,
 * }} options
 *   hint: how the IDE scores, said until the first score.
 *   overlay: the element the output's picture is in, from its top, scrolling
 *   with it if it scrolls. The target is laid over it.
 *   panelAfter: the panel goes right after it.
 *   align: where the output puts its picture across, e.g. p5 centres it.
 *   locate: where the output's picture actually is, in pixels from the top
 *   left of `overlay`, if the IDE can tell; the target's top left is put
 *   there, where the comparison starts. Call realign() when it moves.
 *   drawTarget and drawOutput return canvases of the comparison's size, in
 *   CSS pixels; drawOutput returns null when there is nothing to score.
 *   observe: the target is drawn once this scrolls into view.
 * @returns {{ offscreen: HTMLElement, changed: (options?: { reveal?: boolean }) => Promise<void>, realign: () => void }}
 *   changed(): the reader's output changed; scores it, and reveals the
 *   drawing the first time unless `reveal` is false (e.g. on page load).
 */
export const createComparison = ({
  ide,
  pass,
  hint: firstHint = t("ide-compare-hint"),
  overlay,
  panelAfter,
  align = "start",
  locate,
  drawTarget,
  drawOutput,
  observe,
}) => {
  // --- over the output ---
  overlay.classList.add("ide-compare-host");
  const layer = el("div", "ide-compare-overlay");
  layer.classList.toggle("ide-compare-centered", align === "center");
  const picture = el("div", "ide-compare-picture");
  picture.setAttribute("aria-hidden", "true");
  const targetLayer = el("div", "ide-compare-layer ide-compare-target");
  const diffLayer = el("div", "ide-compare-layer ide-compare-diff");
  const handle = el("div", "ide-compare-handle");
  // The one part that takes the pointer: a sketch may react to the mouse.
  const grip = el("div", "ide-compare-grip");
  const yoursLabel = el("span", "ide-compare-label ide-compare-label-yours", t("ide-compare-yours"));
  const targetLabel = el("span", "ide-compare-label ide-compare-label-target", t("ide-compare-target"));
  const solvedBadge = el("span", "ide-compare-solved", `✓ ${t("ide-compare-solved")}`);
  picture.append(targetLayer, diffLayer, handle, grip, yoursLabel, targetLabel, solvedBadge);
  layer.appendChild(picture);
  layer.hidden = true;
  overlay.appendChild(layer);

  // --- the panel underneath ---
  const panel = el("div", "ide-compare");
  const bar = el("div", "ide-compare-bar");
  // The score: the number, large, and what it is.
  const score = el("span", "ide-compare-score");
  score.setAttribute("aria-live", "polite");
  const scoreValue = el("span", "ide-compare-score-value");
  const scoreWord = el("span", "ide-compare-score-word", t("ide-compare-match"));
  score.append(scoreValue, scoreWord);
  // How far the score is from solved: a bar with a mark at the pass score.
  const meter = el("div", "ide-compare-meter");
  meter.setAttribute("aria-hidden", "true");
  const meterFill = el("span", "ide-compare-meter-fill");
  const meterPass = el("span", "ide-compare-meter-pass");
  meterPass.style.left = `${pass}%`;
  meter.append(meterFill, meterPass);

  const modes = el("div", "ide-compare-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", t("ide-compare-modes"));
  const modeButtons = {};
  for (const [mode, key] of [
    ["split", "ide-compare-mode-split"],
    ["overlay", "ide-compare-mode-overlay"],
    ["diff", "ide-compare-diff"],
  ]) {
    const button = el("button", "ide-compare-mode", t(key));
    button.type = "button";
    button.addEventListener("click", () => {
      view = mode;
      render();
    });
    modes.appendChild(button);
    modeButtons[mode] = button;
  }
  bar.append(score, modes);

  const slide = el("div", "ide-compare-slide");
  const slider = el("input", "ide-compare-slider");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.value = "0";
  slider.setAttribute("aria-label", t("ide-compare-slider"));
  const peek = el("button", "ide-compare-peek");
  peek.type = "button";
  peek.title = t("ide-compare-peek-title");
  peek.append(icon("eye"), el("span", "", t("ide-compare-peek")));
  slide.append(slider, peek);

  const hint = el("p", "ide-compare-hint");
  hint.setAttribute("role", "status");

  // The target's colours, to copy, as on CSSBattle.
  const colours = el("div", "ide-compare-colours");
  const coloursLabel = el("span", "ide-compare-colours-label", t("ide-compare-colours"));
  const palette = el("div", "ide-compare-palette");
  palette.setAttribute("role", "group");
  palette.setAttribute("aria-label", t("ide-compare-colors"));
  colours.append(coloursLabel, palette);
  colours.hidden = true;

  // Where runtimes render out of sight: p5 frames, the solution's canvas.
  const offscreen = el("div", "ide-compare-offscreen");
  offscreen.setAttribute("aria-hidden", "true");
  panel.append(bar, meter, slide, hint, colours, offscreen);
  panelAfter.after(panel);

  /** The target, at the comparison's size, once drawn. */
  let target = null;
  /** The last score. */
  let result = null;
  let message = null;
  /** "split", "overlay" or "diff". */
  let view = "split";
  let peeking = false;
  /** The reader placed the line; it is not moved for them any more. */
  let placed = false;
  let revealed = false;

  const layerOf = (canvas) => {
    canvas.className = "ide-compare-canvas";
    return canvas;
  };

  const showPalette = (canvas) => {
    let colors = [];
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      colors = extractPalette(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch {
      // A canvas that cannot be read has no colours to offer.
    }
    palette.replaceChildren();
    colours.hidden = colors.length === 0;
    for (const { color } of colors) {
      const swatch = el("button", "ide-compare-swatch");
      swatch.type = "button";
      swatch.title = t("ide-compare-copy-color", { color });
      swatch.setAttribute("aria-label", swatch.title);
      const chip = el("span", "ide-compare-chip");
      chip.style.backgroundColor = color;
      const label = el("span", "ide-compare-hex", color);
      swatch.append(chip, label);
      swatch.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(color);
          swatch.classList.add("copied");
          label.textContent = t("ide-compare-copied");
          setTimeout(() => {
            swatch.classList.remove("copied");
            label.textContent = color;
          }, 1200);
        } catch (error) {
          console.error(error);
        }
      });
      palette.appendChild(swatch);
    }
  };

  /** Puts the target where the output's picture is, if the IDE knows. */
  const realign = () => {
    const at = locate?.();
    layer.classList.toggle("ide-compare-located", !!at);
    picture.style.left = at ? `${at.x}px` : "";
    picture.style.top = at ? `${at.y}px` : "";
  };

  /** Shows what the state calls for. */
  const render = () => {
    realign();
    // Where the line is, from the left: the drawing left of it, the target
    // right of it.
    const value = Number(slider.value);
    if (view === "diff" && !result) view = "split";
    const shown = peeking ? "peek" : view;
    const split = shown === "split";
    const solved = !!result?.passed;

    layer.hidden = !target;
    targetLayer.hidden = shown === "diff";
    diffLayer.hidden = shown !== "diff";
    targetLayer.style.clipPath = split ? `inset(0 0 0 ${value}%)` : "none";
    targetLayer.classList.toggle("see-through", shown === "overlay");
    handle.hidden = !split;
    grip.hidden = !split;
    handle.style.left = `${value}%`;
    grip.style.left = `clamp(12px, ${value}%, calc(100% - 12px))`;
    yoursLabel.hidden = solved || !split || value <= 0;
    targetLabel.hidden = solved || !((split && value < 100) || shown === "peek");
    picture.classList.toggle("solved", solved);
    solvedBadge.hidden = !solved;

    slider.disabled = !target || view !== "split";
    peek.disabled = !target;
    for (const [mode, button] of Object.entries(modeButtons)) {
      button.setAttribute("aria-pressed", String(view === mode));
      button.disabled = !target || (mode === "diff" && !result);
    }

    scoreValue.textContent = result ? `${result.score.toFixed(1)} %` : "– %";
    score.setAttribute(
      "aria-label",
      t("ide-compare-score", { score: result ? result.score.toFixed(1) : "–" }),
    );
    score.classList.toggle("passed", solved);
    score.classList.toggle("failed", !!result && !solved);
    meterFill.style.width = `${result ? result.score : 0}%`;
    meter.classList.toggle("passed", solved);
    // What the score is made of, for those who want to know; the hint says
    // what to work on.
    score.title = result
      ? ["colour", "outline", "area"]
          .map((part) =>
            t(`ide-compare-part-${part}`, { score: result.parts[part].toFixed(0) }),
          )
          .join(" · ")
      : "";

    if (message) hint.textContent = message;
    else if (!target) hint.textContent = t("ide-compare-loading");
    else if (!result) hint.textContent = firstHint;
    // After a score, the score says it all: no guess at what is wrong.
    else hint.textContent = "";
  };

  const place = (value) => {
    slider.value = String(Math.max(0, Math.min(100, value)));
    placed = true;
    render();
  };

  slider.addEventListener("input", () => place(Number(slider.value)));

  // Dragging the line by its grip.
  // The moves are followed on the window, so the drag goes on when the
  // pointer leaves the grip, or is not captured.
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // Without capture, the window still gets the moves.
    }
    const move = (moveEvent) => {
      const rect = picture.getBoundingClientRect();
      place(((moveEvent.clientX - rect.left) / rect.width) * 100);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      picture.classList.remove("dragging");
    };
    picture.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });

  // Holding "Target" shows all of it.
  const setPeek = (on) => {
    if (peeking === on) return;
    peeking = on;
    render();
  };
  peek.addEventListener("pointerdown", () => setPeek(true));
  for (const type of ["pointerup", "pointerleave", "pointercancel", "blur"]) {
    peek.addEventListener(type, () => setPeek(false));
  }
  peek.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setPeek(true);
    }
  });
  peek.addEventListener("keyup", () => setPeek(false));

  const say = (text) => {
    message = text;
    render();
  };

  /** The target, drawn once per page load: the solution does not change. */
  let targetPromise = null;
  const ensureTarget = () => {
    targetPromise ??= drawTarget().then(
      (canvas) => {
        target = canvas;
        // At its own size, where the output shows its picture.
        picture.style.width = `${canvas.width}px`;
        picture.style.height = `${canvas.height}px`;
        targetLayer.replaceChildren(layerOf(canvas));
        showPalette(canvas);
        message = null;
        render();
        return canvas;
      },
      (error) => {
        targetPromise = null;
        say(error?.message || `${error}`);
        throw error;
      },
    );
    return targetPromise;
  };

  const compare = (goal, output) => {
    const compared = compareImages(
      goal.getContext("2d", { willReadFrequently: true })
        .getImageData(0, 0, goal.width, goal.height),
      output.getContext("2d", { willReadFrequently: true })
        .getImageData(0, 0, output.width, output.height),
    );
    const diff = document.createElement("canvas");
    diff.width = goal.width;
    diff.height = goal.height;
    diff
      .getContext("2d")
      .putImageData(new ImageData(compared.diff, goal.width, goal.height), 0, 0);
    diffLayer.replaceChildren(layerOf(diff));
    const value = Math.floor(compared.score * 10) / 10;
    result = {
      score: value,
      passed: isSolved(value, compared.parts, pass),
      parts: compared.parts,
    };
    message = null;
    render();
    return result;
  };

  /**
   * Scores the current output. One at a time: a change while scoring runs
   * is scored once more afterwards, with what the reader has by then.
   */
  let scoring = null;
  let again = false;
  const scoreOutput = async () => {
    if (scoring) {
      again = true;
      return scoring;
    }
    scoring = (async () => {
      do {
        again = false;
        score.classList.add("busy");
        try {
          const goal = await ensureTarget();
          const output = await drawOutput();
          if (!output) continue;
          compare(goal, output);
        } catch (error) {
          say(error?.message || `${error}`);
        } finally {
          score.classList.remove("busy");
        }
      } while (again);
    })();
    try {
      await scoring;
    } finally {
      scoring = null;
    }
  };

  const changed = ({ reveal = true } = {}) => {
    // The first change shows the reader their result next to the target.
    if (reveal && !revealed) {
      revealed = true;
      if (!placed && Number(slider.value) === 0) {
        slider.value = "50";
        render();
      }
    }
    return scoreOutput();
  };

  // The target is the task: draw it once the IDE is in sight.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    ide.ready.then(() => ensureTarget().catch(() => {}));
  });
  observer.observe(observe || panel);

  render();
  return { offscreen, changed, realign };
};
