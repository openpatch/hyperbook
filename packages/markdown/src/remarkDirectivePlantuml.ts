// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import pako from "pako";
import { Base64 } from "js-base64";
import { toString } from "mdast-util-to-string";

export function encode(str: string) {
  var data = new TextEncoder().encode(str);
  var buffer = pako.deflate(data, { level: 9 });
  var result = Base64.fromUint8Array(buffer, true);
  return result;
}

export default (ctx: HyperbookContext) => () => {
  const name = "plantuml";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"]);

        const text = toString(node.children);
        const url = `https://kroki.io/plantuml/svg/${encode(text)}`;

        const { alt, width } = node.attributes || {};
        data.hName = "div";
        data.hProperties = {
          class: "directive-alert",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "img",
            properties: {
              alt,
              width,
              src: url,
            },
            children: [],
          },
        ];
      }
    });
  };
};
