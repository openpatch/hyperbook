//@ts-nocheck
import { visit, SKIP } from "unist-util-visit";
import { Transformer } from "unified";
import { BuildVisitor } from "unist-util-visit/complex-types";

export const remarkRemoveComments: () => Transformer = () => (tree) => {
  const htmlCommentRegex = /<!--([\s\S]*?)-->/g;

  const handler: BuildVisitor = (node, index, parent) => {
    const isComment = node.value.match(htmlCommentRegex);

    if (isComment && parent?.children) {
      // remove node
      parent.children.splice(index, 1);
      // Do not traverse `node`, continue at the node *now* at `index`. http://unifiedjs.com/learn/recipe/remove-node/
      return [SKIP, index];
    }
  };

  visit(tree, "html", handler);

  visit(tree, "jsx", handler);
};
