import { visit } from "unist-util-visit";
import { Code, Root } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";

export default (ctx: HyperbookContext) => () => {
  return function (tree: Root, file: VFile) {
    visit(tree, "code", (node: Code) => {
      const config = ctx.config.elements?.code;
      if (!config) return;
      if (!node.meta) {
        node.meta = "";
      }
      if (config.showLineNumbers && !node.meta.includes("showLineNumbers")) {
        node.meta = "showLineNumbers " + node.meta;
      }
    });
  };
};
