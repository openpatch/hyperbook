/**
 * The drawing surface behind the `turtle` module.
 *
 * turtle.py (next to this file) is CPython's own turtle module. The only part
 * of it that is replaced is the bottom layer, which in CPython talks to a Tk
 * canvas: create an item, set its coordinates and colours, raise or delete it,
 * redraw, wait a few milliseconds. This file offers exactly those operations
 * on an HTML canvas, so everything above them -- animation, z-order, fills,
 * undo, clear() -- behaves the way it does on a learner's own computer.
 *
 * Every change is kept twice:
 * - the *model* takes it the moment Python asks, so questions such as "where
 *   are this item's points" are answered at once;
 * - the *view* receives it through a timeline that pauses at every delay
 *   turtle.py asks for. The view is what is drawn, so this is what animates.
 *
 * When Python can be suspended (JSPI), turtle.py waits for the timeline at
 * each delay and runs in step with the animation, as it does under Tk.
 * Otherwise Python finishes first and the timeline plays the recorded changes
 * afterwards, which looks the same.
 */
import { askStdinAsync, askStdinSync } from "./stdin.js";

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

/**
 * Tk's colour names (Tk 8.6, xlib/xcolors.c): each name maps to its colour
 * followed by the numbered variants name1..name4, e.g. "red3".
 */
const TK_COLOR_TABLE =
  "aliceblue:f0f8ff;antiquewhite:faebd7,ffefdb,eedfcc,cdc0b0,8b8378;" +
  "aqua:00ffff;aquamarine:7fffd4,7fffd4,76eec6,66cdaa,458b74;" +
  "azure:f0ffff,f0ffff,e0eeee,c1cdcd,838b8b;beige:f5f5dc;" +
  "bisque:ffe4c4,ffe4c4,eed5b7,cdb79e,8b7d6b;black:000000;" +
  "blanchedalmond:ffebcd;blue:0000ff,0000ff,0000ee,0000cd,00008b;" +
  "blueviolet:8a2be2;brown:a52a2a,ff4040,ee3b3b,cd3333,8b2323;" +
  "burlywood:deb887,ffd39b,eec591,cdaa7d,8b7355;" +
  "cadetblue:5f9ea0,98f5ff,8ee5ee,7ac5cd,53868b;" +
  "chartreuse:7fff00,7fff00,76ee00,66cd00,458b00;" +
  "chocolate:d2691e,ff7f24,ee7621,cd661d,8b4513;" +
  "coral:ff7f50,ff7256,ee6a50,cd5b45,8b3e2f;cornflowerblue:6495ed;" +
  "cornsilk:fff8dc,fff8dc,eee8cd,cdc8b1,8b8878;crimson:dc143c;" +
  "cyan:00ffff,00ffff,00eeee,00cdcd,008b8b;darkblue:00008b;darkcyan:008b8b;" +
  "darkgoldenrod:b8860b,ffb90f,eead0e,cd950c,8b6508;darkgray:a9a9a9;" +
  "darkgreen:006400;darkgrey:a9a9a9;darkkhaki:bdb76b;darkmagenta:8b008b;" +
  "darkolivegreen:556b2f,caff70,bcee68,a2cd5a,6e8b3d;" +
  "darkorange:ff8c00,ff7f00,ee7600,cd6600,8b4500;" +
  "darkorchid:9932cc,bf3eff,b23aee,9a32cd,68228b;darkred:8b0000;" +
  "darksalmon:e9967a;darkseagreen:8fbc8f,c1ffc1,b4eeb4,9bcd9b,698b69;" +
  "darkslateblue:483d8b;darkslategray:2f4f4f,97ffff,8deeee,79cdcd,528b8b;" +
  "darkslategrey:2f4f4f;darkturquoise:00ced1;darkviolet:9400d3;" +
  "deeppink:ff1493,ff1493,ee1289,cd1076,8b0a50;" +
  "deepskyblue:00bfff,00bfff,00b2ee,009acd,00688b;dimgray:696969;" +
  "dimgrey:696969;dodgerblue:1e90ff,1e90ff,1c86ee,1874cd,104e8b;" +
  "firebrick:b22222,ff3030,ee2c2c,cd2626,8b1a1a;floralwhite:fffaf0;" +
  "forestgreen:228b22;fuchsia:ff00ff;gainsboro:dcdcdc;ghostwhite:f8f8ff;" +
  "gold:ffd700,ffd700,eec900,cdad00,8b7500;" +
  "goldenrod:daa520,ffc125,eeb422,cd9b1d,8b6914;" +
  "gray:808080,030303,050505,080808,0a0a0a,0d0d0d,0f0f0f,121212,141414;" +
  "gray0:000000;green:008000,00ff00,00ee00,00cd00,008b00;" +
  "greenyellow:adff2f;" +
  "grey:808080,030303,050505,080808,0a0a0a,0d0d0d,0f0f0f,121212,141414;" +
  "grey0:000000;honeydew:f0fff0,f0fff0,e0eee0,c1cdc1,838b83;" +
  "hotpink:ff69b4,ff6eb4,ee6aa7,cd6090,8b3a62;" +
  "indianred:cd5c5c,ff6a6a,ee6363,cd5555,8b3a3a;indigo:4b0082;" +
  "ivory:fffff0,fffff0,eeeee0,cdcdc1,8b8b83;" +
  "khaki:f0e68c,fff68f,eee685,cdc673,8b864e;lavender:e6e6fa;" +
  "lavenderblush:fff0f5,fff0f5,eee0e5,cdc1c5,8b8386;lawngreen:7cfc00;" +
  "lemonchiffon:fffacd,fffacd,eee9bf,cdc9a5,8b8970;" +
  "lightblue:add8e6,bfefff,b2dfee,9ac0cd,68838b;lightcoral:f08080;" +
  "lightcyan:e0ffff,e0ffff,d1eeee,b4cdcd,7a8b8b;" +
  "lightgoldenrod:eedd82,ffec8b,eedc82,cdbe70,8b814c;" +
  "lightgoldenrodyellow:fafad2;lightgray:d3d3d3;lightgreen:90ee90;" +
  "lightgrey:d3d3d3;lightpink:ffb6c1,ffaeb9,eea2ad,cd8c95,8b5f65;" +
  "lightsalmon:ffa07a,ffa07a,ee9572,cd8162,8b5742;lightseagreen:20b2aa;" +
  "lightskyblue:87cefa,b0e2ff,a4d3ee,8db6cd,607b8b;lightslateblue:8470ff;" +
  "lightslategray:778899;lightslategrey:778899;" +
  "lightsteelblue:b0c4de,cae1ff,bcd2ee,a2b5cd,6e7b8b;" +
  "lightyellow:ffffe0,ffffe0,eeeed1,cdcdb4,8b8b7a;lime:00ff00;" +
  "limegreen:32cd32;linen:faf0e6;" +
  "magenta:ff00ff,ff00ff,ee00ee,cd00cd,8b008b;" +
  "maroon:800000,ff34b3,ee30a7,cd2990,8b1c62;mediumaquamarine:66cdaa;" +
  "mediumblue:0000cd;mediumorchid:ba55d3,e066ff,d15fee,b452cd,7a378b;" +
  "mediumpurple:9370db,ab82ff,9f79ee,8968cd,5d478b;mediumseagreen:3cb371;" +
  "mediumslateblue:7b68ee;mediumspringgreen:00fa9a;mediumturquoise:48d1cc;" +
  "mediumvioletred:c71585;midnightblue:191970;mintcream:f5fffa;" +
  "mistyrose:ffe4e1,ffe4e1,eed5d2,cdb7b5,8b7d7b;moccasin:ffe4b5;" +
  "navajowhite:ffdead,ffdead,eecfa1,cdb38b,8b795e;navy:000080;" +
  "navyblue:000080;oldlace:fdf5e6;olive:808000;" +
  "olivedrab:6b8e23,c0ff3e,b3ee3a,9acd32,698b22;" +
  "orange:ffa500,ffa500,ee9a00,cd8500,8b5a00;" +
  "orangered:ff4500,ff4500,ee4000,cd3700,8b2500;" +
  "orchid:da70d6,ff83fa,ee7ae9,cd69c9,8b4789;palegoldenrod:eee8aa;" +
  "palegreen:98fb98,9aff9a,90ee90,7ccd7c,548b54;" +
  "paleturquoise:afeeee,bbffff,aeeeee,96cdcd,668b8b;" +
  "palevioletred:db7093,ff82ab,ee799f,cd6889,8b475d;papayawhip:ffefd5;" +
  "peachpuff:ffdab9,ffdab9,eecbad,cdaf95,8b7765;peru:cd853f;" +
  "pink:ffc0cb,ffb5c5,eea9b8,cd919e,8b636c;" +
  "plum:dda0dd,ffbbff,eeaeee,cd96cd,8b668b;powderblue:b0e0e6;" +
  "purple:800080,9b30ff,912cee,7d26cd,551a8b;" +
  "red:ff0000,ff0000,ee0000,cd0000,8b0000;" +
  "rosybrown:bc8f8f,ffc1c1,eeb4b4,cd9b9b,8b6969;" +
  "royalblue:4169e1,4876ff,436eee,3a5fcd,27408b;saddlebrown:8b4513;" +
  "salmon:fa8072,ff8c69,ee8262,cd7054,8b4c39;sandybrown:f4a460;" +
  "seagreen:2e8b57,54ff9f,4eee94,43cd80,2e8b57;" +
  "seashell:fff5ee,fff5ee,eee5de,cdc5bf,8b8682;" +
  "sienna:a0522d,ff8247,ee7942,cd6839,8b4726;silver:c0c0c0;" +
  "skyblue:87ceeb,87ceff,7ec0ee,6ca6cd,4a708b;" +
  "slateblue:6a5acd,836fff,7a67ee,6959cd,473c8b;" +
  "slategray:708090,c6e2ff,b9d3ee,9fb6cd,6c7b8b;slategrey:708090;" +
  "snow:fffafa,fffafa,eee9e9,cdc9c9,8b8989;" +
  "springgreen:00ff7f,00ff7f,00ee76,00cd66,008b45;" +
  "steelblue:4682b4,63b8ff,5cacee,4f94cd,36648b;" +
  "tan:d2b48c,ffa54f,ee9a49,cd853f,8b5a2b;teal:008080;" +
  "thistle:d8bfd8,ffe1ff,eed2ee,cdb5cd,8b7b8b;" +
  "tomato:ff6347,ff6347,ee5c42,cd4f39,8b3626;" +
  "turquoise:40e0d0,00f5ff,00e5ee,00c5cd,00868b;violet:ee82ee;" +
  "violetred:d02090,ff3e96,ee3a8c,cd3278,8b2252;" +
  "wheat:f5deb3,ffe7ba,eed8ae,cdba96,8b7e66;white:ffffff;whitesmoke:f5f5f5;" +
  "yellow:ffff00,ffff00,eeee00,cdcd00,8b8b00;yellowgreen:9acd32";

const TK_COLORS = new Map(
  TK_COLOR_TABLE.split(";").map((entry) => {
    const [name, colors] = entry.split(":");
    return [name, colors.split(",")];
  }),
);

const colorCache = new Map();

/**
 * Translate a Tk colour specification into a CSS colour.
 *
 * Tk accepts "#rgb", "#rrggbb", "#rrrgggbbb" and "#rrrrggggbbbb", and colour
 * names in any case and with spaces between words ("light blue", "LightBlue"),
 * optionally numbered ("SpringGreen2", "gray50").
 *
 * @param {string} spec
 * @returns {string | undefined} a "#rrggbb" colour, "" for no colour, or
 *   undefined when Tk would reject the specification.
 */
export const tkColor = (spec) => {
  const text = String(spec ?? "");
  if (text === "") return "";
  if (colorCache.has(text)) return colorCache.get(text);
  let css;
  if (text[0] === "#") {
    const hex = text.slice(1);
    if (/^[0-9a-f]+$/i.test(hex) && [3, 6, 9, 12].includes(hex.length)) {
      const size = hex.length / 3;
      css =
        "#" +
        [0, 1, 2]
          .map((channel) => {
            const part = hex.slice(channel * size, channel * size + size);
            return size === 1 ? part + part : part.slice(0, 2);
          })
          .join("")
          .toLowerCase();
    }
  } else {
    const name = text.toLowerCase().replace(/ /g, "");
    const exact = TK_COLORS.get(name);
    if (exact) {
      css = "#" + exact[0];
    } else {
      const numbered = /^([a-z]+)([1-9]\d*)$/.exec(name);
      const entry = numbered && TK_COLORS.get(numbered[1]);
      const variant = numbered ? Number(numbered[2]) : 0;
      if (entry && variant < entry.length) {
        css = "#" + entry[variant];
      } else if (entry && /^gr[ae]y$/.test(numbered[1]) && variant <= 100) {
        // gray9 .. gray100 are computed, with two quirks kept from Tk.
        let level = Math.floor((variant * 255 + 50) / 100);
        if (level === 230 || level === 128) level -= 1;
        css = "#" + level.toString(16).padStart(2, "0").repeat(3);
      }
    }
  }
  colorCache.set(text, css);
  return css;
};

/** Tk keysyms for the keys whose DOM name differs. */
const KEYSYMS = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "space",
  Enter: "Return",
  Backspace: "BackSpace",
  PageUp: "Prior",
  PageDown: "Next",
  CapsLock: "Caps_Lock",
  "!": "exclam",
  '"': "quotedbl",
  "#": "numbersign",
  $: "dollar",
  "%": "percent",
  "&": "ampersand",
  "'": "apostrophe",
  "(": "parenleft",
  ")": "parenright",
  "*": "asterisk",
  "+": "plus",
  ",": "comma",
  "-": "minus",
  ".": "period",
  "/": "slash",
  ":": "colon",
  ";": "semicolon",
  "<": "less",
  "=": "equal",
  ">": "greater",
  "?": "question",
  "@": "at",
  "[": "bracketleft",
  "\\": "backslash",
  "]": "bracketright",
  "^": "asciicircum",
  _: "underscore",
  "`": "grave",
  "{": "braceleft",
  "|": "bar",
  "}": "braceright",
  "~": "asciitilde",
};

/**
 * The Tk keysym of a keyboard event, e.g. "Up", "space", "a", "Shift_L".
 * @param {{ key: string, code?: string }} event
 */
export const keysymOf = (event) => {
  const { key, code = "" } = event;
  if (key in KEYSYMS) return KEYSYMS[key];
  if (["Shift", "Control", "Alt", "Meta"].includes(key)) {
    return `${key}_${code.endsWith("Right") ? "R" : "L"}`;
  }
  return key;
};

/**
 * A Tk binding sequence the turtle module uses, e.g. "<Button-1>",
 * "<Button1-Motion>", "<KeyPress-Up>", "<KeyRelease-a>" or "<KeyPress>".
 * @returns {{ kind: string, detail: string | null } | null}
 */
export const parseSequence = (sequence) => {
  const text = String(sequence);
  let match = /^<(?:KeyPress|Key)(?:-(.+))?>$/.exec(text);
  if (match) return { kind: "keypress", detail: match[1] ?? null };
  match = /^<KeyRelease(?:-(.+))?>$/.exec(text);
  if (match) return { kind: "keyrelease", detail: match[1] ?? null };
  match = /^<Button-(\d)>$/.exec(text);
  if (match) return { kind: "press", detail: match[1] };
  match = /^<Button(\d)-ButtonRelease>$/.exec(text);
  if (match) return { kind: "release", detail: match[1] };
  match = /^<Button(\d)-Motion>$/.exec(text);
  if (match) return { kind: "motion", detail: match[1] };
  return null;
};

/** CSS font for a Tk font (family, size, style); a negative size is in px. */
export const tkFont = (family, size, style) => {
  const words = String(style || "")
    .toLowerCase()
    .split(/\s+/);
  const numeric = Number(size);
  const fontSize =
    !Number.isFinite(numeric) || numeric === 0
      ? "10pt"
      : numeric < 0
        ? `${-numeric}px`
        : `${numeric}pt`;
  const name = String(family || "Arial");
  const generic = /courier|mono|consol/i.test(name)
    ? "monospace"
    : /times|serif|georgia/i.test(name) && !/sans/i.test(name)
      ? "serif"
      : "sans-serif";
  return {
    css: [
      words.includes("italic") ? "italic" : "",
      words.includes("bold") ? "bold" : "",
      fontSize,
      `"${name.replace(/"/g, "")}", ${generic}`,
    ]
      .filter(Boolean)
      .join(" "),
    underline: words.includes("underline"),
    overstrike: words.includes("overstrike"),
  };
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const defined = (value) => value !== undefined && value !== null;

/** Python bytes arrive as a PyProxy unless the caller converted them. */
const toBytes = (data) => {
  if (data instanceof Uint8Array) return data;
  if (data && typeof data.toJs === "function") {
    try {
      return data.toJs();
    } finally {
      data.destroy?.();
    }
  }
  return new Uint8Array(0);
};

const releaseProxy = (fun) => {
  try {
    fun?.destroy?.();
  } catch {}
};

// ---------------------------------------------------------------- scene ----

/**
 * The canvas content: items in stacking order, background and scroll region.
 * The same structure serves as model and as view; the view additionally
 * tracks what changed since it was last drawn, so drawing can skip the part
 * of the stack that is unchanged.
 */
const createScene = () => ({
  /** @type {Map<number, any>} */
  items: new Map(),
  /** @type {any[]} bottom to top */
  order: [],
  background: "white",
  /** Tk scroll region: the canvas coordinates at the corners. */
  region: [
    -DEFAULT_WIDTH / 2,
    -DEFAULT_HEIGHT / 2,
    DEFAULT_WIDTH / 2,
    DEFAULT_HEIGHT / 2,
  ],
  /** Lowest stack position changed since the last frame; -1 = everything. */
  lowestChange: -1,
  /** Frame counter, see render(). */
  frame: 0,
});

const changedAt = (scene, index) => {
  scene.lowestChange = Math.min(scene.lowestChange, index);
};

const changed = (scene, item) => {
  item.frame = scene.frame;
  const index = scene.order.indexOf(item);
  if (index >= 0) changedAt(scene, index);
};

const addItem = (scene, item) => {
  item.frame = scene.frame;
  scene.items.set(item.id, item);
  scene.order.push(item);
};

const raiseItem = (scene, item) => {
  const index = scene.order.indexOf(item);
  if (index < 0 || index === scene.order.length - 1) return;
  scene.order.splice(index, 1);
  scene.order.push(item);
  item.frame = scene.frame;
  changedAt(scene, index);
};

const lowerItem = (scene, item) => {
  const index = scene.order.indexOf(item);
  if (index <= 0) return;
  scene.order.splice(index, 1);
  scene.order.unshift(item);
  changedAt(scene, 0);
};

const removeItem = (scene, id) => {
  const item = scene.items.get(id);
  if (!item) return;
  scene.items.delete(id);
  const index = scene.order.indexOf(item);
  scene.order.splice(index, 1);
  changedAt(scene, index);
};

// ------------------------------------------------------------- geometry ----

const pointInPolygon = (coords, x, y) => {
  let inside = false;
  for (let i = 0, j = coords.length - 2; i < coords.length; j = i, i += 2) {
    const xi = coords[i];
    const yi = coords[i + 1];
    const xj = coords[j];
    const yj = coords[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const distanceToPolyline = (coords, x, y, closed) => {
  let best = Infinity;
  const count = coords.length / 2;
  const segments = closed ? count : count - 1;
  for (let s = 0; s < segments; s += 1) {
    const x1 = coords[2 * s];
    const y1 = coords[2 * s + 1];
    const x2 = coords[(2 * s + 2) % coords.length];
    const y2 = coords[(2 * s + 3) % coords.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = dx * dx + dy * dy;
    const t =
      length === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  if (count === 1) best = Math.hypot(x - coords[0], y - coords[1]);
  return best;
};

// --------------------------------------------------------------- canvas ----

/**
 * One drawing surface per pyide element.
 * @param {string} id the pyide element's id
 */
export const createTurtleCanvas = (id) => {
  let model = createScene();
  let view = createScene();
  let nextItemId = 1;

  /** @type {HTMLCanvasElement | null} */
  let canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  let context = null;
  /** Offscreen copy of the bottom part of the stack, see render(). */
  let layer = null;
  let layerContext = null;
  let layerItems = 0;
  let layerReady = false;
  let pixelRatio = 1;
  /** Only an active canvas draws and waits; a test run is not active. */
  let active = false;
  /** Set by the Stop button: the view stays frozen until the next run. */
  let stopped = false;

  // ---- images ----
  /** @type {Map<number, { image: HTMLImageElement | null }>} */
  const images = new Map([[0, { image: null }]]);
  let nextImageId = 1;

  // ---- text measuring ----
  let measureContext = null;
  const measure = (text, font) => {
    if (!measureContext && typeof document !== "undefined") {
      measureContext = document.createElement("canvas").getContext("2d");
    }
    const fallback = 13;
    if (!measureContext) {
      return {
        width: text.length * fallback * 0.6,
        ascent: fallback * 0.8,
        descent: fallback * 0.2,
      };
    }
    measureContext.font = font;
    const metrics = measureContext.measureText(text);
    const reference = measureContext.measureText("Mg");
    return {
      width: metrics.width,
      ascent:
        reference.fontBoundingBoxAscent ?? reference.actualBoundingBoxAscent,
      descent:
        reference.fontBoundingBoxDescent ?? reference.actualBoundingBoxDescent,
    };
  };

  // ------------------------------------------------------------ timeline ----

  let queue = [];
  let queueHead = 0;
  let playing = false;
  /** Bumped by stop/reset, so a timeline that is mid-wait gives up. */
  let generation = 0;
  let drainWaiters = [];
  let idleWaiters = [];
  let frameWaiters = [];
  let animationFrame = 0;

  const isDrained = () => !playing && queueHead >= queue.length;

  const settle = () => {
    if (!isDrained()) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    waiters.forEach((resolve) => resolve(false));
    flushMotion();
    checkIdle();
  };

  const perform = (entry) => {
    if (entry.change) {
      entry.change(view);
    } else if (entry.update) {
      requestRender();
    }
  };

  const play = async () => {
    playing = true;
    const current = generation;
    while (current === generation && queueHead < queue.length) {
      const entry = queue[queueHead++];
      if (entry.delay !== undefined) {
        if (entry.delay > 0 && active) {
          // Show this frame before waiting, as Tk does in update().
          renderNow();
          await new Promise((resolve) => setTimeout(resolve, entry.delay));
        }
      } else {
        perform(entry);
      }
      if (queueHead > 4096 && queueHead * 2 > queue.length) {
        queue = queue.slice(queueHead);
        queueHead = 0;
      }
    }
    if (current !== generation) return;
    playing = false;
    queue = [];
    queueHead = 0;
    settle();
  };

  /** Hand an entry to the view: now if nothing is waiting, else in order. */
  const schedule = (entry) => {
    if (isDrained()) {
      if (entry.delay === undefined) {
        perform(entry);
        return;
      }
      if (!(entry.delay > 0 && active)) return;
    }
    queue.push(entry);
    if (!playing) void play();
  };

  /** Apply a change to the model now and to the view in timeline order. */
  const record = (change) => {
    change(model);
    if (!stopped) schedule({ change });
  };

  // ----------------------------------------------------------- rendering ----

  const requestRender = () => {
    if (animationFrame || typeof requestAnimationFrame !== "function") return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      renderNow();
      const waiters = frameWaiters;
      frameWaiters = [];
      waiters.forEach((resolve) => resolve(false));
    });
  };

  /** Resize the canvas element to the scroll region; true if it changed. */
  const fitCanvas = () => {
    const [x1, y1, x2, y2] = view.region;
    const width = Math.max(1, Math.round(x2 - x1));
    const height = Math.max(1, Math.round(y2 - y1));
    const ratio =
      (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight &&
      canvas.style.width === `${width}px` &&
      canvas.style.height === `${height}px` &&
      pixelRatio === ratio &&
      layer
    ) {
      return false;
    }
    pixelRatio = ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    layer = layer || document.createElement("canvas");
    layer.width = pixelWidth;
    layer.height = pixelHeight;
    layerContext = layer.getContext("2d");
    // Keep the middle of a large drawing in sight, like Tk's ScrolledCanvas.
    const wrapper = canvas.parentElement;
    if (wrapper) {
      wrapper.scrollLeft = Math.max(0, (width - wrapper.clientWidth) / 2);
      wrapper.scrollTop = Math.max(0, (height - wrapper.clientHeight) / 2);
    }
    return true;
  };

  /** Work in canvas coordinates: (0, 0) is the middle in standard mode. */
  const useCanvasCoordinates = (target) => {
    const [x1, y1] = view.region;
    target.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      -x1 * pixelRatio,
      -y1 * pixelRatio,
    );
  };

  const paintBackground = (target) => {
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.fillStyle = tkColor(view.background) || "#ffffff";
    target.fillRect(0, 0, target.canvas.width, target.canvas.height);
  };

  // Tk puts a coordinate at the centre of a pixel; canvas at its corner.
  const tracePath = (target, coords, closed) => {
    target.beginPath();
    target.moveTo(coords[0] + 0.5, coords[1] + 0.5);
    for (let i = 2; i < coords.length; i += 2) {
      target.lineTo(coords[i] + 0.5, coords[i + 1] + 0.5);
    }
    if (closed) target.closePath();
  };

  const isPoint = (coords) => {
    for (let i = 2; i < coords.length; i += 2) {
      if (coords[i] !== coords[0] || coords[i + 1] !== coords[1]) return false;
    }
    return true;
  };

  const drawLine = (target, item) => {
    const color = tkColor(item.fill);
    if (!color || item.coords.length < 4) return;
    const width = item.width > 0 ? item.width : 1;
    if (isPoint(item.coords)) {
      // A zero-length line with round caps is a dot (this is how dot() draws).
      target.beginPath();
      target.arc(
        item.coords[0] + 0.5,
        item.coords[1] + 0.5,
        width / 2,
        0,
        2 * Math.PI,
      );
      target.fillStyle = color;
      target.fill();
      return;
    }
    tracePath(target, item.coords, false);
    target.lineCap = "round";
    target.lineJoin = "round";
    target.lineWidth = width;
    target.strokeStyle = color;
    target.stroke();
  };

  const drawPolygon = (target, item) => {
    if (item.coords.length < 6) return;
    const fill = tkColor(item.fill);
    const outline = tkColor(item.outline);
    if (!fill && !outline) return;
    tracePath(target, item.coords, true);
    if (fill) {
      target.fillStyle = fill;
      // Tk fills polygons with the even-odd rule.
      target.fill("evenodd");
    }
    if (outline) {
      target.lineJoin = "round";
      target.lineWidth = item.width > 0 ? item.width : 1;
      target.strokeStyle = outline;
      target.stroke();
    }
  };

  const textBox = (item) => {
    const [x, y] = item.coords;
    const left =
      item.anchor === "s"
        ? x - item.width / 2
        : item.anchor === "se"
          ? x - item.width
          : x;
    return {
      left,
      top: y - item.lines.length * item.lineHeight,
      right: left + item.width,
      bottom: y,
    };
  };

  const drawText = (target, item) => {
    const color = tkColor(item.fill);
    if (!color) return;
    const box = textBox(item);
    target.font = item.font.css;
    target.fillStyle = color;
    target.textAlign = "left";
    target.textBaseline = "alphabetic";
    item.lines.forEach((line, index) => {
      const baseline =
        box.bottom -
        (item.lines.length - 1 - index) * item.lineHeight -
        item.descent;
      target.fillText(line, box.left, baseline);
      const thickness = Math.max(1, item.lineHeight / 16);
      if (item.font.underline) {
        target.fillRect(
          box.left,
          baseline + thickness,
          item.lineWidths[index],
          thickness,
        );
      }
      if (item.font.overstrike) {
        target.fillRect(
          box.left,
          baseline - item.ascent / 3,
          item.lineWidths[index],
          thickness,
        );
      }
    });
  };

  const imageBox = (item) => {
    const image = images.get(item.image)?.image;
    if (!image || !image.complete || !image.naturalWidth) return null;
    const [x, y] = item.coords;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    return {
      image,
      left: x - width / 2,
      top: y - height / 2,
      width,
      height,
    };
  };

  const drawImage = (target, item) => {
    const box = imageBox(item);
    if (box) target.drawImage(box.image, box.left, box.top);
  };

  const drawItem = (target, item) => {
    if (item.type === "line") drawLine(target, item);
    else if (item.type === "polygon") drawPolygon(target, item);
    else if (item.type === "text") drawText(target, item);
    else if (item.type === "image") drawImage(target, item);
  };

  /**
   * Draw the view. Items that have not changed for a while are kept in an
   * offscreen layer, so a frame only redraws the few items that move (the
   * turtle, the line being drawn) instead of the whole picture.
   */
  const STABLE_FRAMES = 8;
  const renderNow = () => {
    if (animationFrame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (!active || !canvas || !context) return;
    const resized = fitCanvas();
    if (resized || !layerReady || view.lowestChange < layerItems) {
      paintBackground(layerContext);
      layerItems = 0;
      layerReady = true;
    }
    view.lowestChange = Infinity;
    const { order } = view;
    if (layerItems < order.length) {
      useCanvasCoordinates(layerContext);
      while (
        layerItems < order.length &&
        order[layerItems].frame <= view.frame - STABLE_FRAMES
      ) {
        drawItem(layerContext, order[layerItems]);
        layerItems += 1;
      }
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(layer, 0, 0);
    useCanvasCoordinates(context);
    for (let index = layerItems; index < order.length; index += 1) {
      drawItem(context, order[index]);
    }
    view.frame += 1;
  };

  // ------------------------------------------------------------- events ----

  /** Tk-style bindings: "canvas" or an item id -> sequence -> handlers. */
  const bindings = new Map();
  const timers = new Map();
  let grabbedItem = null;
  let pendingMotion = null;
  let detachListeners = null;

  const handlersFor = (target, kind, detail) =>
    bindings.get(target)?.get(`${kind}:${detail ?? "*"}`) || [];

  const call = (fun, ...args) => {
    try {
      fun(...args);
    } catch (error) {
      // turtle.py reports errors in handlers itself; this only catches a
      // handler that has been released in the meantime.
      console.error(error);
    }
    requestRender();
  };

  // On a touch screen, dragging a turtle must not scroll the page instead.
  const updateTouchAction = () => {
    if (!canvas) return;
    const dragging = [...bindings.values()].some((sequences) =>
      [...sequences.keys()].some((key) => key.startsWith("motion")),
    );
    canvas.style.touchAction = dragging ? "none" : "";
  };

  const hasKeyBindings = () =>
    [...(bindings.get("canvas")?.keys() || [])].some((key) =>
      key.startsWith("key"),
    );

  const canvasPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const [x1, y1, x2, y2] = view.region;
    const scaleX = rect.width ? (x2 - x1) / rect.width : 1;
    const scaleY = rect.height ? (y2 - y1) / rect.height : 1;
    return [
      (event.clientX - rect.left) * scaleX + x1,
      (event.clientY - rect.top) * scaleY + y1,
    ];
  };

  const hit = (item, x, y) => {
    const { coords } = item;
    if (item.type === "polygon" && coords.length >= 6) {
      if (tkColor(item.fill) && pointInPolygon(coords, x, y)) return true;
      return (
        !!tkColor(item.outline) &&
        distanceToPolyline(coords, x, y, true) <= item.width / 2 + 1
      );
    }
    if (item.type === "line" && coords.length >= 4 && tkColor(item.fill)) {
      return distanceToPolyline(coords, x, y, false) <= item.width / 2 + 1;
    }
    if (item.type === "text") {
      const box = textBox(item);
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    }
    if (item.type === "image") {
      const box = imageBox(item);
      return (
        !!box &&
        x >= box.left &&
        x <= box.left + box.width &&
        y >= box.top &&
        y <= box.top + box.height
      );
    }
    return false;
  };

  const itemAt = (x, y) => {
    for (let index = view.order.length - 1; index >= 0; index -= 1) {
      if (hit(view.order[index], x, y)) return view.order[index];
    }
    return null;
  };

  const flushMotion = () => {
    if (!pendingMotion) return;
    const { handlers, x, y } = pendingMotion;
    pendingMotion = null;
    handlers.forEach((fun) => call(fun, x, y));
  };

  const attachListeners = (element) => {
    const listeners = [];
    const listen = (type, handler) => {
      element.addEventListener(type, handler);
      listeners.push(() => element.removeEventListener(type, handler));
    };
    // Tk numbers buttons 1 (left), 2 (middle), 3 (right).
    const buttonNumber = (button) => String([1, 2, 3][button] ?? button + 1);

    listen("pointerdown", (event) => {
      const [x, y] = canvasPoint(event);
      const button = buttonNumber(event.button);
      grabbedItem = itemAt(x, y);
      if (grabbedItem) {
        handlersFor(grabbedItem.id, "press", button).forEach((fun) =>
          call(fun, x, y),
        );
      }
      handlersFor("canvas", "press", button).forEach((fun) => call(fun, x, y));
      element.setPointerCapture?.(event.pointerId);
    });
    listen("pointermove", (event) => {
      if (!grabbedItem || !event.buttons) return;
      const button = event.buttons & 1 ? "1" : event.buttons & 4 ? "2" : "3";
      const handlers = handlersFor(grabbedItem.id, "motion", button);
      if (!handlers.length) return;
      const [x, y] = canvasPoint(event);
      // Like Tk, report only the latest position while the turtle is busy.
      pendingMotion = { handlers, x, y };
      if (isDrained()) flushMotion();
    });
    listen("pointerup", (event) => {
      const [x, y] = canvasPoint(event);
      const button = buttonNumber(event.button);
      flushMotion();
      if (grabbedItem) {
        handlersFor(grabbedItem.id, "release", button).forEach((fun) =>
          call(fun, x, y),
        );
      }
      grabbedItem = null;
    });
    listen("contextmenu", (event) => {
      const [x, y] = canvasPoint(event);
      const item = itemAt(x, y);
      if (
        handlersFor("canvas", "press", "3").length ||
        (item && handlersFor(item.id, "press", "3").length)
      ) {
        event.preventDefault();
      }
    });
    const onKey = (kind) => (event) => {
      // Bindings may name the key as Tk does ("Up") or as the browser does
      // ("ArrowUp"). Like Tk, a binding for this key wins over one for any key.
      const names = [keysymOf(event), event.key, event.code];
      const bound = (eventKind) =>
        names.find((name) => handlersFor("canvas", eventKind, name).length);
      const specific = bound(kind);
      const handlers =
        specific !== undefined
          ? handlersFor("canvas", kind, specific)
          : handlersFor("canvas", kind, null);
      // Keep arrows and space from scrolling the page while the turtle has them.
      if (
        specific !== undefined ||
        bound(kind === "keypress" ? "keyrelease" : "keypress") !== undefined ||
        (handlers.length && event.key !== "Tab")
      ) {
        event.preventDefault();
      }
      // Holding a key while the turtle is still drawing would pile up moves.
      if (event.repeat && !isDrained()) return;
      handlers.forEach((fun) => call(fun));
    };
    listen("keydown", onKey("keypress"));
    listen("keyup", onKey("keyrelease"));
    return () => listeners.forEach((remove) => remove());
  };

  const clearBindings = () => {
    for (const sequences of bindings.values()) {
      for (const handlers of sequences.values()) handlers.forEach(releaseProxy);
    }
    bindings.clear();
    updateTouchAction();
    for (const [timer, fun] of timers) {
      clearTimeout(timer);
      releaseProxy(fun);
    }
    timers.clear();
    grabbedItem = null;
    pendingMotion = null;
  };

  const checkIdle = () => {
    if (!isDrained() || timers.size > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  /**
   * Drop everything still waiting in the timeline. A program waiting for it
   * is woken with `true`, which turtle.py answers by ending the program.
   * @returns whether a program was waiting
   */
  const haltTimeline = () => {
    generation += 1;
    queue = [];
    queueHead = 0;
    playing = false;
    const waiters = [...drainWaiters, ...frameWaiters];
    drainWaiters = [];
    frameWaiters = [];
    waiters.forEach((resolve) => resolve(true));
    return waiters.length > 0;
  };

  // ------------------------------------------------------------- items ----

  const newItem = (type, fields) => {
    const id = nextItemId;
    nextItemId += 1;
    record((scene) =>
      addItem(scene, {
        id,
        type,
        coords: [0, 0, 0, 0],
        fill: "",
        outline: "",
        width: 1,
        ...fields,
      }),
    );
    return id;
  };

  const configure = (itemId, fields, coords, top) =>
    record((scene) => {
      const item = scene.items.get(itemId);
      if (!item) return;
      Object.assign(item, fields);
      if (coords.length) item.coords = coords;
      changed(scene, item);
      if (top) raiseItem(scene, item);
    });

  const pick = (values) =>
    Object.fromEntries(
      Object.entries(values).filter(([, value]) => defined(value)),
    );

  // ----------------------------------------------------- python facing ----

  const backend = {
    new_line: () => newItem("line", { width: 2 }),
    new_polygon: () => newItem("polygon", { coords: [0, 0, 0, 0, 0, 0] }),
    new_image: (image = 0) =>
      newItem("image", { coords: [0, 0], image: toNumber(image) }),

    /** Create a text item; returns [id, x0, y0, x1, y1] of its box. */
    new_text: (x, y, text, anchor, color, family, size, style) => {
      const font = tkFont(family, size, style);
      const lines = String(text).split("\n");
      const metrics = lines.map((line) => measure(line, font.css));
      const ascent = metrics[0].ascent;
      const descent = metrics[0].descent;
      const lineHeight = ascent + descent;
      const lineWidths = metrics.map((metric) => metric.width);
      const fields = {
        coords: [toNumber(x), toNumber(y)],
        anchor: String(anchor),
        fill: String(color ?? ""),
        font,
        lines,
        lineWidths,
        width: Math.max(...lineWidths),
        ascent,
        descent,
        lineHeight,
      };
      const itemId = newItem("text", fields);
      const box = textBox(fields);
      return [itemId, box.left, box.top, box.right + 1, box.bottom];
    },

    /** _drawline: unchanged fields (fill, width, coords) may be left out. */
    draw_line: (itemId, fill, width, top, ...coords) =>
      configure(
        itemId,
        pick({ fill: defined(fill) ? String(fill) : fill, width }),
        coords.map(Number),
        !!top,
      ),

    draw_polygon: (itemId, fill, outline, width, top, ...coords) =>
      configure(
        itemId,
        pick({
          fill: defined(fill) ? String(fill) : fill,
          outline: defined(outline) ? String(outline) : outline,
          width,
        }),
        coords.map(Number),
        !!top,
      ),

    draw_image: (itemId, x, y, image) =>
      configure(
        itemId,
        { image: toNumber(image) },
        [toNumber(x), toNumber(y)],
        false,
      ),

    /** The background picture: shown below everything else. */
    set_background_image: (itemId, image) =>
      record((scene) => {
        const item = scene.items.get(itemId);
        if (!item) return;
        item.image = toNumber(image);
        changed(scene, item);
        lowerItem(scene, item);
      }),

    delete: (itemId) => record((scene) => removeItem(scene, itemId)),
    delete_all: () =>
      record((scene) => {
        scene.items.clear();
        scene.order = [];
        scene.lowestChange = -1;
      }),

    /** Points of an item as Python last set them (not as currently shown). */
    coords: (itemId) => [...(model.items.get(itemId)?.coords || [])],
    item_type: (itemId) => model.items.get(itemId)?.type || "",

    update: () => schedule({ update: true }),
    delay: (ms) => schedule({ delay: Math.max(0, toNumber(ms)) }),

    /** Set the background colour if given; return the current one. */
    background: (color) => {
      if (defined(color)) {
        const value = String(color);
        record((scene) => {
          scene.background = value;
          scene.lowestChange = -1;
        });
      }
      return model.background;
    },

    is_color: (spec) => tkColor(spec) !== undefined,

    scroll_region: (x1, y1, x2, y2) => {
      const region = [x1, y1, x2, y2].map((value) => toNumber(value));
      record((scene) => {
        scene.region = region;
        scene.lowestChange = -1;
      });
    },

    /** setworldcoordinates: scale every item by the change in scale. */
    rescale: (factorX, factorY) => {
      const fx = toNumber(factorX, 1);
      const fy = toNumber(factorY, 1);
      record((scene) => {
        for (const item of scene.items.values()) {
          item.coords = item.coords.map((value, index) =>
            index % 2 ? value * fy : value * fx,
          );
        }
        scene.lowestChange = -1;
      });
    },

    window_size: () => {
      const [x1, y1, x2, y2] = model.region;
      return [Math.round(x2 - x1), Math.round(y2 - y1)];
    },

    /** Decode an image file from Python bytes; returns its handle. */
    load_image: (data, type = "") => {
      const handle = nextImageId;
      nextImageId += 1;
      const entry = { image: null };
      images.set(handle, entry);
      if (typeof Image === "function") {
        const url = URL.createObjectURL(
          new Blob([toBytes(data)], { type: String(type || "") }),
        );
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(url);
          view.lowestChange = -1;
          requestRender();
        };
        image.onerror = () => URL.revokeObjectURL(url);
        image.src = url;
        entry.image = image;
      }
      return handle;
    },

    /**
     * Bind (or with fun=None, unbind) a handler to a Tk event sequence on the
     * canvas (item < 0) or on an item. Handlers are Python proxies that this
     * side owns and releases.
     */
    bind: (item, sequence, fun, add) => {
      const parsed = parseSequence(sequence);
      if (!parsed || stopped) {
        releaseProxy(fun);
        return;
      }
      const target = toNumber(item, -1) < 0 ? "canvas" : toNumber(item);
      const key = `${parsed.kind}:${parsed.detail ?? "*"}`;
      if (!bindings.has(target)) bindings.set(target, new Map());
      const sequences = bindings.get(target);
      const previous = sequences.get(key) || [];
      if (!defined(fun)) {
        previous.forEach(releaseProxy);
        sequences.delete(key);
      } else if (add) {
        sequences.set(key, [...previous, fun]);
      } else {
        previous.forEach(releaseProxy);
        sequences.set(key, [fun]);
      }
      updateTouchAction();
    },

    /** listen(): send key presses to the canvas. */
    focus: () => canvas?.focus?.({ preventScroll: true }),

    after: (ms, fun) => {
      if (stopped) {
        releaseProxy(fun);
        return;
      }
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          call(fun);
          releaseProxy(fun);
          checkIdle();
        },
        Math.max(0, toNumber(ms)),
      );
      timers.set(timer, fun);
    },

    /**
     * Resolves once the view has caught up with everything recorded; with
     * `true` if the program was stopped meanwhile.
     */
    drained: () =>
      stopped || isDrained()
        ? Promise.resolve(stopped)
        : new Promise((resolve) => drainWaiters.push(resolve)),

    /** Resolves after the next frame, so the browser can show progress. */
    next_frame: () => {
      if (stopped || !active || typeof requestAnimationFrame !== "function") {
        return Promise.resolve(stopped);
      }
      requestRender();
      return new Promise((resolve) => frameWaiters.push(resolve));
    },

    ask: (prompt) => askStdinAsync(id, String(prompt ?? "")),
    ask_sync: (prompt) => askStdinSync(id, String(prompt ?? "")),

    set_title: (title) => canvas?.setAttribute("aria-label", String(title)),

    /** bye(): the program is over, its handlers no longer run. */
    close: () => clearBindings(),

    // ---- for the pyide element ----

    __bindCanvas: (element) => {
      if (element === canvas) return;
      detachListeners?.();
      detachListeners = null;
      canvas = element || null;
      context = canvas?.getContext?.("2d") || null;
      layer = null;
      layerReady = false;
      if (canvas) {
        canvas.tabIndex = 0;
        detachListeners = attachListeners(canvas);
      }
    },

    /**
     * Start a run: an empty white canvas, no handlers. Without a canvas (a
     * test run) nothing is drawn and nothing waits.
     */
    __resetState: (element = canvas) => {
      haltTimeline();
      stopped = false;
      clearBindings();
      model = createScene();
      view = createScene();
      layerReady = false;
      active = !!element && element === canvas && !!context;
      checkIdle();
      renderNow();
    },

    /**
     * Stop button: freeze the drawing where it is and end the program.
     * @returns whether the program was waiting for the turtle, in which case
     *   it ends by itself (turtle.py raises Terminator).
     */
    __stop: () => {
      const woken = haltTimeline();
      stopped = true;
      clearBindings();
      checkIdle();
      renderNow();
      return woken;
    },

    /** The canvas is used by something else (e.g. pygame). */
    __deactivate: () => {
      haltTimeline();
      stopped = false;
      clearBindings();
      model = createScene();
      view = createScene();
      active = false;
      checkIdle();
    },

    __redraw: () => renderNow(),

    /** Resolves when the drawing is finished and no timer is pending. */
    __whenIdle: () =>
      new Promise((resolve) => {
        idleWaiters.push(resolve);
        checkIdle();
      }),

    __hasKeyBindings: hasKeyBindings,
  };

  return backend;
};
