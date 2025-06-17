import { SKIP, visit } from "unist-util-visit";
import { Code, Root, InlineCode } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";

export default (ctx: HyperbookContext) => () => {
  return function (tree: Root, file: VFile) {
    visit(tree, "inlineCode", (node: InlineCode, index, parent) => {
      const config = ctx.config.elements?.code;

      if (!config || !config.bypassInline) return;
      // add span node around inline code
      const data = node.data || (node.data = {});

      data.hName = "span";
      data.hChildren = [
        {
          type: "element",
          properties: {},
          tagName: "code",
          children: [
            {
              type: "text",
              value: node.value,
            },
          ],
        },
      ];
    });
    visit(tree, "code", (node: Code) => {
      const config = ctx.config.elements?.code;
      if (!config) return;
      if (!node.meta) {
        node.meta = "";
      }
      node.type;
      if (config.showLineNumbers && !node.meta.includes("showLineNumbers")) {
        node.meta = "showLineNumbers " + node.meta;
      }
    });
  };
};
