// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";

/** Whether the page shows its table of contents (the header's button and
 * the drawer it opens). */
export const tocEnabled = (ctx: HyperbookContext) =>
  (ctx.config.toc ?? true) && (ctx.navigation.current?.toc ?? true);

/**
 * The page's table of contents: the drawer here, its button in the header
 * (rehypeShell).
 */
export default (ctx: HyperbookContext) => () => {
  const showToc = tocEnabled(ctx);
  return (tree: Root, file: VFile) => {
    const headings = file.data.headings || [];
    const originalChildren = tree.children as ElementContent[];

    const tocDrawer: ElementContent = {
      type: "element",
      tagName: "side-drawer",
      properties: {
        id: "toc-drawer",
        right: true,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "toc-drawer-content",
          },
          children: [
            {
              type: "element",
              tagName: "nav",
              properties: {
                class: "toc",
              },
              children: [
                {
                  type: "element",
                  tagName: "ul",
                  properties: {},
                  children: headings.map((heading) => ({
                    type: "element",
                    tagName: "li",
                    properties: {
                      class: `level-${heading.level}`,
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "a",
                        properties: {
                          href: `#${heading.anchor}`,
                        },
                        children: [
                          {
                            type: "text",
                            value: heading.label,
                          },
                        ],
                      },
                    ],
                  })),
                },
              ],
            },
          ],
        },
      ],
    };

    tree.children = [
      {
        type: "element",
        tagName: "div",
        properties: {
          class: "hyperbook-markdown",
        },
        children: [...(showToc ? [tocDrawer] : []), ...originalChildren],
      },
    ];
  };
};
