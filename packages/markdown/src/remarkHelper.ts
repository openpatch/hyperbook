// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
import { Code, Image } from "mdast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { Node, Point, Position } from "unist";
import { VFile } from "vfile";
import { Script } from "@hyperbook/types";

/** Where a diagnostic points: a node, or a position or point taken from one. */
type Place = Node | Position | Point | null | undefined;

const placeOf = (place: Place): Position | Point | undefined => {
  if (!place) return undefined;
  if ("type" in place) return (place as Node).position;
  return place as Position | Point;
};

/*
 * Report a problem with a stable rule id, so tools reading the diagnostics
 * (hyperbook lint --json, the editor) can tell kinds of problems apart.
 * vfile's three levels: a warning, an info, and a fatal error that stops the
 * page.
 */
export function fileWarning(
  file: VFile,
  ruleId: string,
  reason: string,
  place?: Place,
) {
  return file.message(reason, {
    place: placeOf(place),
    ruleId,
    source: "hyperbook",
  });
}

export function fileInfo(
  file: VFile,
  ruleId: string,
  reason: string,
  place?: Place,
) {
  return file.info(reason, {
    place: placeOf(place),
    ruleId,
    source: "hyperbook",
  });
}

export function fileFail(
  file: VFile,
  ruleId: string,
  reason: string,
  place?: Place,
): never {
  return file.fail(reason, {
    place: placeOf(place),
    ruleId,
    source: "hyperbook",
  });
}

export const findFlat = <G extends Node>(
  node: Node,
  predicate: (n: Node) => n is G,
): G[] => {
  const nodes: G[] = [];

  function inner(n: Node) {
    if (predicate(n)) {
      nodes.push(n);
    }
    if ("children" in n && Array.isArray(n.children)) {
      n.children.forEach(inner);
    }
  }

  inner(node);

  return nodes;
};

export const registerDirective = (
  file: VFile,
  directive: string,
  scripts: Script[] = [],
  styles: string[] = [],
  additionalDirective: string[] = [],
) => {
  if (!file.data.directives) {
    file.data.directives = {};
  }
  file.data.directives[directive] = {
    scripts,
    styles,
    addditionalDirective: additionalDirective || [],
  };
};

export const requestJS = (file: VFile, js: string[]) => {
  if (!file.data.js) {
    file.data.js = [];
  }

  if (!file.data.js.find((s) => JSON.stringify(s) === JSON.stringify(js))) {
    file.data.js.push(js);
  }
};

export const requestCSS = (file: VFile, css: string[]) => {
  if (!file.data.css) {
    file.data.css = [];
  }

  if (!file.data.css.find((s) => JSON.stringify(s) === JSON.stringify(css))) {
    file.data.css.push(css);
  }
};

export const isImage = (node: Node): node is Image => {
  return node.type === "image";
};

export const isCode = (node: Node): node is Code => {
  return node.type === "code";
};

export const isDirective = (
  node: Node,
): node is TextDirective | LeafDirective | ContainerDirective => {
  return (
    node.type === "containerDirective" ||
    node.type === "leafDirective" ||
    node.type === "textDirective"
  );
};

/** The three shapes a directive can be written in. */
export type DirectiveForm = "text" | "leaf" | "container";

const FORM_OF: Record<string, DirectiveForm> = {
  textDirective: "text",
  leafDirective: "leaf",
  containerDirective: "container",
};

const COLONS: Record<DirectiveForm, string> = {
  text: ":",
  leaf: "::",
  container: ":::",
};

const HOW_TO_WRITE: Record<DirectiveForm, string> = {
  text: "one colon",
  leaf: "two colons",
  container: "three colons",
};

/**
 * Reports a directive written in a form it does not support.
 *
 * Several directives accept more than one form — `geogebra` takes its material
 * from either an attribute or a body, `p5` and `struktolab` likewise — so the
 * allowed set is a list. Asserting a single form for those reports correct
 * usage as a mistake, which is worse than not checking at all.
 */
export const expectDirective = (
  node: Node,
  file: VFile,
  name: string,
  allowed: DirectiveForm[],
) => {
  const form = FORM_OF[node.type];
  // Not a directive node at all (abc-music retypes a code fence), or already
  // one of the accepted shapes.
  if (!form || allowed.includes(form)) return;

  const wanted = allowed.map((a) => `${HOW_TO_WRITE[a]} (${COLONS[a]}${name})`);
  const suggestion =
    wanted.length === 1
      ? `use ${wanted[0]}`
      : `use ${wanted.slice(0, -1).join(", ")} or ${wanted[wanted.length - 1]}`;

  fileInfo(
    file,
    "wrong-directive-form",
    `Unexpected "${COLONS[form]}${name}" ${form} directive, ${suggestion}`,
    node,
  );
};

export const expectLeafDirective = (node: Node, file: VFile, name: string) =>
  expectDirective(node, file, name, ["leaf"]);

export const expectTextDirective = (node: Node, file: VFile, name: string) =>
  expectDirective(node, file, name, ["text"]);

export const expectContainerDirective = (
  node: Node,
  file: VFile,
  name: string,
) => expectDirective(node, file, name, ["container"]);
