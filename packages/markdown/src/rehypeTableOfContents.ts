// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  const showToc = ctx.navigation.current?.toc || true;
  return (tree: Root, file: VFile) => {
    const headings = file.data.headings || [];
    const originalChildren = tree.children as ElementContent[];

    if (!showToc) {
      return;
    }

    const tocSidebar: ElementContent[] = [
      {
        type: "element",
        tagName: "button",
        properties: {
          id: "toc-toggle",
          onclick: "hyperbook.tocToggle()",
          title: i18n.get("table-of-contents"),
        },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar1",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar2",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar3",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar4",
            },
            children: [],
          },
        ],
      },
      {
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
      },
    ];

    tree.children = [
      {
        type: "element",
        tagName: "div",
        properties: {
          class: "hyperbook-markdown",
        },
        children: [...tocSidebar, ...originalChildren],
      },
    ];
  };
};
