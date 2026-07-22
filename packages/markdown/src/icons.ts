import { ElementContent } from "hast";

/**
 * Inline SVG icons for directive toolbars.
 *
 * Font glyphs were tried first, but coverage is poor for exactly the symbols a
 * toolbar needs — U+2913 (download) and U+26F6 (fullscreen) ship in fewer than
 * ten of the fonts installed on a typical Linux system, so readers saw tofu.
 * These render identically everywhere and inherit the button's colour through
 * `currentColor`.
 *
 * Paths from Feather Icons (https://feathericons.com), MIT licensed.
 */

type IconName =
  | "reset"
  | "copy"
  | "download"
  | "fullscreen"
  | "lock"
  | "plus"
  | "chevron"
  | "archive";

/** Path data per icon, drawn on Feather's 24×24 grid. */
const PATHS: Record<IconName, string[]> = {
  // rotate-ccw
  reset: ["M1 4v6h6", "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"],
  // two offset sheets
  copy: [
    "M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V9z",
    "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  ],
  // arrow into a tray
  download: [
    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
    "M7 10l5 5 5-5",
    "M12 15V3",
  ],
  // four corner brackets
  fullscreen: [
    "M8 3H5a2 2 0 0 0-2 2v3",
    "M21 8V5a2 2 0 0 0-2-2h-3",
    "M16 21h3a2 2 0 0 0 2-2v-3",
    "M3 16v3a2 2 0 0 0 2 2h3",
  ],
  // closed padlock
  lock: [
    "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
    "M7 11V7a5 5 0 0 1 10 0v4",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  // lidded box — the whole project rather than a single file
  archive: ["M21 8v13H3V8", "M1 3h22v5H1z", "M10 12h4"],
  // disclosure arrow; rotated by CSS when the section is open
  chevron: ["M9 18l6-6-6-6"],
};

/**
 * Build a toolbar icon. The button carries the label via `title`/`aria-label`,
 * so the graphic itself is hidden from assistive technology.
 */
export const icon = (name: IconName): ElementContent => ({
  type: "element",
  tagName: "svg",
  properties: {
    className: ["icon", `icon-${name}`],
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
  },
  children: PATHS[name].map((d) => ({
    type: "element",
    tagName: "path",
    properties: { d },
    children: [],
  })),
});
