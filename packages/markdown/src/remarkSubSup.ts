//@ts-nocheck
/**
 * Subscript and Superscript plugin for Remark.
 */
import { visit } from "unist-util-visit";
import { Transformer } from "unified";
import { Data, Literal, Node } from "unist";

export default function supersub(): Transformer {
  // Superscript
  return (tree) => {
    visit(tree, ["sup"], (node, i, parent) => {
      if (node.type !== "sup") {
        return;
      }

      const data = node.data || (node.data = {});
      data.hName = "sup";
    });

    // Subscript
    visit(tree, ["sub"], (node, i, parent) => {
      if (node.type !== "sub") {
        return;
      }
      const data = node.data || (node.data = {});
      data.hName = "sub";
    });
  };
}
