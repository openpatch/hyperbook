// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "h5p";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const data = node.data || (node.data = {});
        const { src, id = hash(node), ...props } = node.attributes || {};

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["main.bundle.js", "client.js"],
          ["style.css"],
          [],
        );

        const {} = node.attributes || {};
        data.hName = "div";
        data.hProperties = {
          class: "directive-h5p",
          "data-src": src
            ? ctx.makeUrl(src, "public", ctx.navigation.current || undefined)
            : undefined,
          "data-id": id,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "h5p-frame",
            },
            children: [],
          },
        ];
      }
    });
  };
};
