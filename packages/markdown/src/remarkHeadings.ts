import { visit } from "unist-util-visit";
import { Root } from "mdast";
import { Heading } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";
import { toString } from "mdast-util-to-string";
import { i18n } from "./i18n";

const customHeading = (node: Heading) => {
  let lastChild = node.children[node.children.length - 1];
  if (lastChild && lastChild.type === "text") {
    let string = lastChild.value.replace(/ +$/, "");
    let matched = string.match(/ {#([^]+?)}$/);

    if (matched) {
      let id = matched[1];
      if (!!id.length) {
        if (!node.data) {
          node.data = {};
        }
        if (!node.data.hProperties) {
          node.data.hProperties = {};
        }
        (node.data as any).id = node.data.hProperties.id = id;

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
        const anchor = makeAnchor(value);
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
                children: [
                  {
                    type: "text",
                    value,
                  },
                ],
              },
            ],
          },
        ];
        if (config.elements?.bookmarks !== false) {
          node.data.hChildren?.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "bookmark",
              onclick: `hyperbook.ui.toggleBookmark("${key}", "${label}")`,
              title: i18n.get("toggle-bookmark"),
              "data-key": key,
            },
            children: [
              {
                type: "text",
                value: "🔖",
              },
            ],
          });
        }
      });
    };
  };
