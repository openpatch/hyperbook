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
          // make link target blank for external links
          if (node.type === "link" && /^https?:\/\//.test(node.url)) {
            if (!node.data) node.data = {};
            if (!node.data.hProperties) node.data.hProperties = {};
            node.data.hProperties.target = "_blank";
            node.data.hProperties.rel = "noopener noreferrer";
          }
          node.url = ctx.makeUrl(
            node.url,
            "public",
            ctx.navigation.current || undefined,
          );
        }
      }
    });
  };
};
