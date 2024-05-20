import { Plugin } from "unified";
import { Root as MdastRoot, Heading as AstHeading } from "mdast";
import { Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";

export interface Heading {
  level: number;
  label: string;
  anchor: string;
}

const getAnchor = (heading: AstHeading): string => {
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

const headings = (root: MdastRoot) => {
  const headingList: Heading[] = [];

  visit(root, "heading", (node: AstHeading) => {
    const heading: Heading = {
      level: node.depth,
      label: toString(node, { includeImageAlt: false }),
      anchor: getAnchor(node),
    };

    headingList.push(heading);
  });

  return headingList;
};

export const remarkHeadings: Plugin<[], MdastRoot, HastRoot> = () => {
  return (tree, file) => {
    file.data.headings = headings(tree);
  };
};
