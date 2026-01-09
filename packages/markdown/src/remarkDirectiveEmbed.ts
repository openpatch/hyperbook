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

export default (ctx: HyperbookContext) => () => {
  const name = "embed";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        const {
          aspectRatio,
          width = "100%",
          height = "400px",
          src,
          allowFullScreen = true,
          title,
        } = node.attributes || {};
        data.hName = "div";
        data.hProperties = {
          class: "directive-embed",
          style: `aspect-ratio: ${aspectRatio}; height: ${height}; width: ${width}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src,
              title,
              allowfullscreen: allowFullScreen,
            },
            children: [],
          },
        ];
      }
    });
  };
};
