import { DOCKABLE } from "./remarkDock";
import { closest } from "./directiveNames";

/*
 * The attributes each element reads, for reporting the ones it does not.
 *
 * An attribute an element does not know is silently ignored, so `titel=` or
 * `heigth=` builds cleanly and simply has no effect. Elements missing from
 * this table are not checked at all, which is the safe direction to be wrong
 * in; `tests/directiveAttributes.test.ts` keeps the table in step with what
 * the plugins read and with every page of the documentation.
 */

/** `true` takes any value; a list names the only values that work. */
type AttributeSpec = true | readonly string[];

interface ElementSpec {
  attributes: Record<string, AttributeSpec>;
  /**
   * How an attribute the table does not list is reported. `info` for
   * elements where unknown attributes have a use the table cannot see.
   */
  unknown?: "warning" | "info";
  /** Appended to the message about an unknown attribute. */
  hint?: string;
}

/** Elements that read their files through the shared IDE workspace. */
const WORKSPACE = {
  main: true,
  files: true,
  accept: true,
  compare: true,
  pass: true,
  frame: true,
} as const;

const attrs = (...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, true as const]));

/** Elements whose attributes are passed on wholesale; not checked. */
const OPEN = new Set([
  // Every other attribute is a parameter of the GeoGebra applet.
  "geogebra",
  // Every other attribute is passed on to the Blockflow editor.
  "blockflow-editor",
  // A code fence retyped into a directive; it reads none.
  "abc-music",
]);

const ELEMENTS: Record<string, ElementSpec> = {
  alert: {
    attributes: attrs("info", "warn", "success", "error", "color", "label"),
    // A type is just a class on the box, so one styled in custom CSS works.
    unknown: "info",
    hint: "Alert types are info, warn, success and error; any other type only shows if you style it in custom CSS.",
  },
  archive: { attributes: attrs("name", "include") },
  audio: {
    attributes: attrs("src", "thumbnail", "title", "author", "position"),
  },
  bitflow: {
    attributes: attrs("height", "maxHeight", "src", "locale", "readonly"),
  },
  "blockflow-player": {
    attributes: attrs("src", "width", "height", "aspectRatio"),
  },
  bookmarks: { attributes: {} },
  collapsible: { attributes: attrs("title") },
  download: { attributes: attrs("src") },
  embed: {
    attributes: attrs(
      "aspectRatio",
      "width",
      "height",
      "src",
      "allowFullScreen",
      "title",
      "consent",
    ),
  },
  excalidraw: {
    attributes: attrs("aspectRatio", "autoZoom", "edit", "src", "onlinkopen"),
  },
  file: {
    attributes: attrs("path", "src", "font", "hidden", "readonly", "role"),
  },
  h5p: { attributes: attrs("src", "export", "download-url") },
  jmp: {
    attributes: attrs(
      "height",
      "src",
      "step",
      "language",
      "hide-sidebar",
      "hide-call-method",
      "hide-declare-global-variable",
      "hide-new-array",
      "disable-garbage-collector",
      "create-new-on-edge-drop",
      "inline-strings",
      "hide-steps",
      "hide-step-changes",
      "gc-prediction",
      "hide-undo-redo",
      "hide-download-png",
      "hide-download-all-png",
      "hide-print-mode",
      "hide-help",
      "hide-save",
    ),
  },
  jsxgraph: {
    attributes: attrs(
      "height",
      "width",
      "boundingbox",
      "keepaspectratio",
      // The old misspelling: still read, and reported by the element.
      "keepaspetcratio",
      "showNavigation",
      "zoom",
      "pan",
      "keyboard",
      "axis",
      "grid",
    ),
  },
  kirimoto: {
    attributes: attrs("height", "mode", "model", "workspace", "settings"),
  },
  learningmap: { attributes: attrs("height", "src") },
  mermaid: { attributes: {} },
  multievent: { attributes: {} },
  onlineide: {
    attributes: attrs(
      "height",
      "fileList",
      "console",
      "pCode",
      "libraries",
      "bottomPanel",
      "errorList",
      "speed",
      "outputWidth",
    ),
  },
  openscad: {
    attributes: { ...attrs("height", "library", "src"), ...WORKSPACE },
  },
  p5: {
    attributes: {
      ...attrs("height", "src", "editor"),
      mode: ["preview", "editor"],
      ...WORKSPACE,
    },
  },
  pagelist: { attributes: attrs("format", "orderBy", "source", "limit") },
  passwordlist: {
    attributes: attrs(
      "scope",
      "source",
      "type",
      "format",
      "orderBy",
      "limit",
      "groupBy",
      "columns",
      "collapsible",
      "showCount",
    ),
  },
  // view and pages are checked by the element, with better messages.
  pdf: {
    attributes: attrs("src", "view", "pages", "inputs", "download", "height"),
  },
  plantuml: { attributes: attrs("alt", "width") },
  protect: { attributes: attrs("password", "use", "description") },
  pyide: {
    attributes: {
      ...attrs("packages", "height", "canvas", "src"),
      ...WORKSPACE,
    },
  },
  qr: {
    attributes: { ...attrs("value", "label"), size: ["S", "M", "L", "XL"] },
  },
  // The documentation offers language="…"; the renderer detects the
  // language on its own, so it is harmless.
  scratchblock: { attributes: attrs("language") },
  slideshow: { attributes: attrs("height") },
  sqlide: { attributes: attrs("db", "height") },
  step: { attributes: attrs("title", "image", "video") },
  struktog: { attributes: attrs("data") },
  struktolab: {
    attributes: {
      ...attrs(
        "lang",
        "colorMode",
        "fontSize",
        "scale",
        "src",
        "code",
        "hideCode",
      ),
      mode: ["preview", "edit"],
    },
  },
  t: { attributes: {} },
  tab: { attributes: attrs("title") },
  tabs: { attributes: {} },
  term: { attributes: {} },
  textinput: { attributes: attrs("placeholder", "height") },
  tile: { attributes: attrs("title", "size", "icon", "href") },
  tiles: { attributes: {} },
  typst: {
    attributes: {
      ...attrs("height", "packages"),
      mode: ["preview", "edit"],
      ...WORKSPACE,
    },
  },
  video: { attributes: attrs("src", "title", "author", "poster") },
  webide: { attributes: { ...attrs("height"), ...WORKSPACE } },
  youtube: { attributes: {} },
};

/** Every element takes these: `#id` and `.class` are shorthand for them. */
const UNIVERSAL = ["id", "class"];

/** The attributes `name` accepts, or undefined when it is not checked. */
export function attributesOf(
  name: string,
): Record<string, AttributeSpec> | undefined {
  if (OPEN.has(name)) return undefined;
  const spec = ELEMENTS[name];
  if (!spec) return undefined;
  return {
    ...Object.fromEntries(UNIVERSAL.map((a) => [a, true as const])),
    ...(name in DOCKABLE ? { dock: true as const } : {}),
    ...spec.attributes,
  };
}

/** Names the table covers, for the tests. */
export const CHECKED_ELEMENTS = Object.keys(ELEMENTS);
export const OPEN_ELEMENTS = [...OPEN];

export interface AttributeProblem {
  ruleId: "unknown-attribute" | "invalid-attribute-value";
  level: "warning" | "info";
  reason: string;
}

/** What is wrong with the attributes written on an element, if anything. */
export function checkAttributes(
  written: string,
  name: string,
  attributes: Record<string, string | null | undefined>,
): AttributeProblem[] {
  const known = attributesOf(name);
  if (!known) return [];
  const spec = ELEMENTS[name]!;
  const problems: AttributeProblem[] = [];
  const names = Object.keys(known);

  for (const [attribute, value] of Object.entries(attributes)) {
    const allowed = known[attribute];
    if (allowed === undefined) {
      const suggestion = closest(attribute, names);
      const takes = names.length > 0 ? ` It takes: ${names.join(", ")}.` : "";
      problems.push({
        ruleId: "unknown-attribute",
        level: spec.unknown ?? "warning",
        reason:
          `"${written}" has no attribute "${attribute}", so it is ignored.` +
          (suggestion ? ` Did you mean "${suggestion}"?` : "") +
          (spec.hint ? ` ${spec.hint}` : takes),
      });
      continue;
    }
    if (
      allowed !== true &&
      typeof value === "string" &&
      !allowed.includes(value)
    ) {
      problems.push({
        ruleId: "invalid-attribute-value",
        level: "warning",
        reason: `"${written}" does not know ${attribute}="${value}". Use one of: ${allowed.join(", ")}.`,
      });
    }
  }
  return problems;
}
