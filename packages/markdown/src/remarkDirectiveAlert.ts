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

export default (ctx: HyperbookContext) => () => {
  const name = "alert";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        const type = Object.keys(node.attributes || {}).join(" ");
        data.hName = "div";
        data.hProperties = {
          class: ("directive-alert " + type).trim(),
        };
      }
    });
  };
};
