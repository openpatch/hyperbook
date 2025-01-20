// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { findAfter } from "unist-util-find-after";
import { Node } from "unified/lib";
import { VFile, VFileData } from "vfile";
import { getAnchor } from "./remarkCollectHeadings";
import { toText } from "./mdastUtilToText";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const searchDocuments: VFileData["searchDocuments"] = [];

    visit(tree, function (node, index, parent) {
      if (node.type === "heading") {
        const start = node;
        const startIndex = index;
        const depth = start.depth;

        const isEnd = (node: Node) =>
          (node.type === "heading" && node.depth <= depth) ||
          node.type === "export";
        if (!parent) return;
        const end = findAfter(parent, start, isEnd);
        const endIndex = parent.children.indexOf(end);

        const between = parent.children.slice(
          startIndex,
          endIndex > 0 ? endIndex : undefined,
        );

        const anchor = getAnchor(node);
        const content = toText(between);
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
