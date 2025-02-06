// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
import { Code, Image } from "mdast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { Node } from "unified/lib";
import { VFile } from "vfile";

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
  scripts: string[] = [],
  styles: string[] = [],
) => {
  if (!file.data.directives) {
    file.data.directives = {};
  }
  file.data.directives[directive] = {
    scripts,
    styles,
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

export const expectLeafDirective = (node: Node, file: VFile, name: string) => {
  if (node.type === "textDirective") {
    file.info(
      `Unexpected ":${name}" text directive, use two colons for a leaf directive`,
      node,
    );
  } else if (node.type === "containerDirective") {
    file.info(
      `Unexpected ":::${name}" container directive, use two colons for a leaf directive`,
      node,
    );
  }
};

export const expectTextDirective = (node: Node, file: VFile, name: string) => {
  if (node.type === "leafDirective") {
    file.info(
      `Unexpected "::${name}" leaf directive, use one colon for a text directive`,
      node,
    );
  } else if (node.type === "containerDirective") {
    file.info(
      `Unexpected ":::${name}" container directive, use one colon for a text directive`,
      node,
    );
  }
};

export const expectContainerDirective = (
  node: Node,
  file: VFile,
  name: string,
) => {
  if (node.type === "leafDirective") {
    file.info(
      `Unexpected "::${name}" leaf directive, use three colons for a container directive`,
      node,
    );
  } else if (node.type === "textDirective") {
    file.info(
      `Unexpected ":${name}" container directive, use three colons for a container directive`,
      node,
    );
  }
};
