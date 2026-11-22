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
import { resolveDirectiveId } from "./directiveId";
import { recordStoredElement } from "./storedElements";

export default (ctx: HyperbookContext) => () => {
  const name = "multievent";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["multievent.js"], ["style.css"], []);

        // The key the reader's state is saved under (multievent.js storeKey).
        const id = (node.attributes?.id as string | undefined) || resolveDirectiveId(file, node);
        recordStoredElement(file, name, id, node);

        data.hName = "div";
        data.hProperties = {
          class: "directive-multievent multievent",
          "data-id": id,
          style: "visibility: hidden; opacity: 0;",
        };
      }
    });
  };
};
