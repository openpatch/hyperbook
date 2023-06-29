import { Plugin, unified } from "unified";
import { Root as MdastRoot } from "mdast";
import { Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import remarkStringify from "remark-stringify";
import remarkParse from "remark-parse";
import { TocProps } from "./types";

export interface Heading {
  depth: number;
  value: string;
  data?: any;
}

const headings = (root: MdastRoot) => {
  const headingList: Heading[] = [];

  visit(root, "heading", (node: Heading) => {
    const heading: Heading = {
      depth: node.depth,
      value: toString(node, { includeImageAlt: false }),
    };

    // Other remark plugins can store arbitrary data
    // inside a node's `data` property, such as a
    // custom heading id.
    const data = node?.data;
    if (data) {
      heading.data = data;
    }

    headingList.push(heading);
  });

  return headingList;
};

const remarkHeadings: Plugin<[], MdastRoot, HastRoot> = () => {
  return (tree, file) => {
    file.data.headings = headings(tree);
  };
};

const makeAnchor = (heading: string) => {
  // If we have a heading, make it lower case
  let anchor = heading.toLowerCase();

  // Clean anchor (replace special characters whitespaces).
  // Alternatively, use encodeURIComponent() if you don't care about
  // pretty anchor links
  anchor = anchor.replace(/[^a-zA-Z0-9 ]/g, "");
  anchor = anchor.replace(/ /g, "-");

  return anchor;
};

export const getToc = (markdown: string): TocProps => {
  try {
    return {
      headings: unified()
        .use(remarkParse)
        .use(remarkStringify)
        .use(remarkHeadings)
        .processSync(markdown)
        .data.headings.map((h: Heading) => ({
          level: h.depth,
          label: h.value,
          anchor: makeAnchor(h.value),
        })),
    };
  } catch {
    return {
      headings: [],
    };
  }
};
