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
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "multievent";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["multievent.js"], ["style.css"], []);

        // Generate a unique ID for this multievent instance based on node content
        const id = hash(node);

        data.hName = "div";
        data.hProperties = {
          class: "directive-multievent multievent",
          "data-id": id,
        };
      }
    });
  };
};
