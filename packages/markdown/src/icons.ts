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

type IconName = "reset" | "copy" | "download" | "fullscreen";

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
