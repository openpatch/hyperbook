import { visit } from "unist-util-visit";
import { Root } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";

export default (ctx: HyperbookContext) => () => {
  return function (tree: Root, file: VFile) {
    visit(tree, (node, index) => {
      if (
        typeof index === "number" &&
        (node.type === "link" ||
          node.type === "linkReference" ||
          node.type === "image" ||
          node.type === "imageReference" ||
          node.type === "definition")
      ) {
        if (node.url) {
          node.url = ctx.makeUrl(node.url, "public");
        }
      }
    });
  };
};
