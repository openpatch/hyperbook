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
  const name = "textinput";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const {
          placeholder = "",
          height = "200px",
          id = hash(node),
        } = node.attributes || {};

        data.hName = "div";
        data.hProperties = {
          class: "directive-textinput",
          "data-id": id,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "textarea",
            properties: {
              class: "textinput",
              "data-id": id,
              placeholder: placeholder as string,
              style: `height: ${height}`,
            },
            children: [],
          },
        ];
      }
    });
  };
};
