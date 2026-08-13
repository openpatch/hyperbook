// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Parent, Root } from "mdast";
import { visit } from "unist-util-visit";
import { findAfter } from "unist-util-find-after";
import { VFile, VFileData } from "vfile";
import { getAnchor } from "./remarkCollectHeadings";
import { toText } from "./mdastUtilToText";
import {
  collectProtectedNodes,
  isPageProtected,
  isProtectedWrapper,
} from "./protectedNodes";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const searchDocuments: VFileData["searchDocuments"] = [];

    // A protected page contributes nothing at all: the search index stores the
    // full text of every section, so indexing it would publish the content the
    // password is meant to withhold.
    if (isPageProtected(ctx)) {
      file.data.searchDocuments = [];
      return;
    }

    const protectedNodes = collectProtectedNodes(tree);

    visit(tree, function (node, index, parent: Parent | undefined) {
      if (node.type === "heading") {
        // Headings inside a protect block would leak the outline and link to
        // content that is not there until it is unlocked.
        if (protectedNodes.has(node)) return;

        const start = node;
        const startIndex = index;
        const depth = start.depth;

        const isEnd = (node: any) =>
          (node.type === "heading" && node.depth <= depth) ||
          node.type === "export";
        if (!parent) return;
        const end = findAfter(parent, start, isEnd);
        const endIndex = end ? parent.children.indexOf(end) : -1;

        const between = parent.children.slice(
          startIndex,
          endIndex > 0 ? endIndex : undefined,
        );

        const anchor = getAnchor(node);
        // A section may contain a protect block; its text is dropped while the
        // surrounding prose is still indexed.
        const content = toText(between, { skip: isProtectedWrapper });
        searchDocuments.push({
          href: `${ctx.navigation.current?.href || ""}#${anchor}`,
          heading: toText(node) || ctx.navigation.current?.name || "",
          content,
          keywords: ctx.navigation.current?.keywords || [],
          description: ctx.navigation.current?.description || "",
        });
      }
    });

    file.data.searchDocuments = searchDocuments;
  };
};
