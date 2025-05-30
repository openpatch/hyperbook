// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Node, Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile, VFileData } from "vfile";
import { Root as MdastRoot, Heading as AstHeading } from "mdast";
import { toString } from "mdast-util-to-string";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const headings = getHeadings(tree);
    file.data.headings = headings;
  };
};

export const getAnchor = (heading: AstHeading): string => {
  // If we have a heading, make it lower case
  if ((heading?.data as any)?.id) {
    return (heading.data as any).id as string;
  }

  let anchor = toString(heading, { includeImageAlt: false }).toLowerCase();

  // Clean anchor (replace special characters whitespaces).
  // Alternatively, use encodeURIComponent() if you don't care about
  // pretty anchor links
  anchor = anchor.replace(/[^a-zA-Z0-9 ]/g, "");
  anchor = anchor.replace(/ /g, "-");

  return anchor;
};

const getHeadings = (root: MdastRoot): VFileData["headings"] => {
  const headingList: VFileData["headings"] = [];

  visit(root, "heading", (node: AstHeading) => {
    const heading = {
      level: node.depth,
      label: toString(node, { includeImageAlt: false }),
      anchor: getAnchor(node),
    };

    headingList.push(heading);
  });

  return headingList;
};
