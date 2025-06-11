// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const directives = Object.keys(file.data.directives || {}).flatMap((n) => [
      ...(file.data?.directives?.[n].addditionalDirective || []),
      n,
    ]);
    // TODO move p5 to remark plugins.
    directives.push("p5");
    visit(tree, (node) => {
      if (
        (node.type === "textDirective" ||
          node.type === "leafDirective" ||
          node.type === "containerDirective") &&
        !directives.includes(node.name)
      ) {
        if (node.type === "textDirective") {
          node.value = `:${node.name}`;
        } else if (node.type === "leafDirective") {
          node.value = `::${node.name}`;
        } else if (node.type === "containerDirective") {
          node.value = `:::${node.name}`;
        }
        node.type = "text";
        node.data = {};
      }
    });
  };
};
