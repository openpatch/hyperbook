import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visitParents } from "unist-util-visit-parents";

/**
 * True for the wrapper node remarkDirectiveProtect puts around the content of
 * a protect block. Its subtree is encrypted at the rehype stage, so nothing
 * inside it may reach the search index, the heading list or llms.txt.
 */
export const isProtectedWrapper = (node: any): boolean =>
  Boolean(node?.data?.hyperbookProtected);

/**
 * Nodes whose subtree is protected, plus every node inside them.
 *
 * remarkDirectiveProtect runs before the collectors, so by the time they see
 * the tree the protect blocks are already wrapped and can be recognised.
 */
export const collectProtectedNodes = (tree: Root): Set<unknown> => {
  const protectedNodes = new Set<unknown>();

  visitParents(tree, (node, ancestors) => {
    if (isProtectedWrapper(node) || ancestors.some(isProtectedWrapper)) {
      protectedNodes.add(node);
    }
  });

  return protectedNodes;
};

/** True when the whole page is protected through its frontmatter. */
export const isPageProtected = (ctx: HyperbookContext): boolean =>
  Boolean(ctx.navigation.current?.protect);
