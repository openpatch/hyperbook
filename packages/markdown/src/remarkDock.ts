// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { i18n } from "./i18n";
import { isDirective, requestCSS, requestJS } from "./remarkHelper";

/**
 * The dock: a drawer at the screen edge that a reader can move a working
 * element into, to keep it in view while reading the tasks around it. Docked
 * elements share the drawer as tabs.
 *
 * An element is dockable only when its author asks for it:
 *
 * ```md
 * :::pyide{dock}
 * :::
 *
 * ::textinput{dock="Notizen"}
 * ```
 *
 * `dock` takes an optional label for the drawer's tab; without one the
 * element's kind names it.
 *
 * Runs after the directives: they have built their element by then, and this
 * only marks it. The client (`dock.js`) adds the button and the drawer, and
 * never moves the element in the page, so editors and drawings keep their
 * state.
 */
const DOCKABLE: Record<string, string> = {
  pyide: "dock-label-pyide",
  webide: "dock-label-webide",
  p5: "dock-label-p5",
  openscad: "dock-label-openscad",
  typst: "dock-label-typst",
  onlineide: "dock-label-onlineide",
  sqlide: "dock-label-sqlide",
  excalidraw: "dock-label-excalidraw",
  textinput: "dock-label-textinput",
  struktolab: "dock-label-struktolab",
  "blockflow-editor": "dock-label-blockflow-editor",
  jmp: "dock-label-jmp",
};

/** `dock` off: absent, or written out as false. */
const dockLabel = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === "false") return null;
  return text;
};

export default (_ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      if (!isDirective(node)) return;
      const key = DOCKABLE[node.name];
      if (!key) return;

      const label = dockLabel(node.attributes?.dock);
      if (label === null) return;

      const data = node.data || (node.data = {});
      // A directive that failed to build its element (an error box) has no
      // properties to mark.
      if (!data.hProperties) return;

      data.hProperties = {
        ...data.hProperties,
        "data-dock": node.name,
        "data-dock-label": label || i18n.get(key),
      };

      requestJS(file, ["dock.js"]);
      requestCSS(file, ["dock.css"]);
    });
  };
};
