import { visit } from "unist-util-visit";
import { Root } from "mdast";
import { Heading } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";
import { toString } from "mdast-util-to-string";
import { i18n } from "./i18n";
import type { Element, ElementContent } from "hast";

const customHeading = (node: Heading) => {
  let lastChild = node.children[node.children.length - 1];
  if (lastChild && lastChild.type === "text") {
    let string = lastChild.value.replace(/ +$/, "");
    let matched = string.match(/ {#([^]+?)}$/);

    if (matched) {
      // An id cannot contain whitespace, so a heading like `{#idd id}` would
      // link nowhere. Join it the way the generated anchors do.
      let id = matched[1].trim().replace(/\s+/g, "-");
      if (!!id.length) {
        if (!node.data) {
          node.data = {};
        }
        (node.data as any).id = id;

        string = string.substring(0, matched.index);
        lastChild.value = string;
      }
    }
  }
};

export const makeAnchor = (heading: string) => {
  // If we have a heading, make it lower case
  let anchor = heading.toLowerCase().trim();

  // Clean anchor (replace special characters whitespaces).
  // Alternatively, use encodeURIComponent() if you don't care about
  // pretty anchor links
  anchor = anchor.replace(/[^a-zA-Z0-9 ]/g, "");
  anchor = anchor.replace(/ /g, "-");

  return anchor;
};

/** Math nodes that `remark-math` parses into a heading (`$x$`, `$$x$$`). */
const isMath = (node: any) =>
  node?.type === "inlineMath" || node?.type === "math";

/**
 * The element that `rehype-katex` renders.
 *
 * `hChildren` replaces the children that `mdast-util-to-hast` would build, so
 * the element for math has to be built here. `remark-math` already stores the
 * hast mapping on the node (`hName`, `hProperties` for the `math-inline` class
 * and `hChildren` for the TeX source), so following that data yields the same
 * element the library builds for math outside of a heading.
 */
const mathElement = (node: any): Element => {
  const data = node.data || {};
  return {
    type: "element",
    tagName: data.hName || "span",
    properties: data.hProperties || {},
    children: data.hChildren || [{ type: "text", value: node.value }],
  };
};

/**
 * The content of the heading link.
 *
 * A heading is one link with one label, so everything else collapses to its
 * text (bold, code and friends would otherwise change the look of the
 * heading). Math stays an element, so that KaTeX can render it.
 */
const headingContent = (node: Heading, value: string): ElementContent[] => {
  if (!node.children.some(isMath)) {
    return [{ type: "text", value }];
  }

  return node.children.map((child) =>
    isMath(child)
      ? mathElement(child)
      : {
          type: "text",
          value: toString(child, { includeImageAlt: false }),
        },
  );
};

export default ({
    config,
    makeUrl,
    navigation: { current },
  }: HyperbookContext) =>
  () => {
    return function (tree: Root, file: VFile) {
      visit(tree, "heading", (node: Heading) => {
        customHeading(node);
        const value = toString(node, { includeImageAlt: false });
        // A `{#custom-id}` in the heading is taken as written, so the links an
        // author pinned to it keep working when the heading text changes.
        const anchor = (node.data as any)?.id || makeAnchor(value);
        const label = value || anchor;

        if (!node.data) {
          node.data = {};
        }
        node.data.id = anchor;
        node.data.hProperties = {
          id: anchor,
        };

        let key = "#" + anchor;
        if (current?.href) {
          key = makeUrl(current.href, "book") + key;
        }

        node.data.hChildren = [
          {
            type: "element",
            tagName: "a",
            properties: {
              href: `#${anchor}`,
              class: "heading",
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: {},
                children: headingContent(node, value),
              },
            ],
          },
        ];
        if (config.elements?.bookmarks !== false) {
          node.data.hChildren?.push({
            type: "element",
            tagName: "button",
            properties: {
              type: "button",
              class: "bookmark",
              title: i18n.get("toggle-bookmark"),
              "aria-label": i18n.get("toggle-bookmark"),
              "aria-pressed": "false",
              "data-key": key,
              // Plain text fallback. The label is normally read from the
              // rendered heading, so it keeps whatever the page shows.
              "data-label": label,
            },
            // The icon comes from the stylesheet, so it does not depend on
            // the emoji font of the reader and does not change with the
            // emoji style of the hyperbook.
            children: [],
          });
        }
      });
    };
  };
