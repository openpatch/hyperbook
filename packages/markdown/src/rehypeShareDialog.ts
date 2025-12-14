// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const originalChildren = tree.children as ElementContent[];
    const headings = file.data.headings as Array<{
      anchor: string;
      label: string;
      level: number;
    }> || [];

    if (!ctx.navigation.current?.href) {
      return;
    }

    // Build TOC-like structure with checkboxes for each heading
    const headingCheckboxes: ElementContent[] = headings.map((heading) => ({
      type: "element",
      tagName: "label",
      properties: {
        class: `heading-item level-${heading.level}`,
      },
      children: [
        {
          type: "element",
          tagName: "input",
          properties: {
            type: "checkbox",
            value: heading.anchor,
            "data-anchor": heading.anchor,
            onchange: "hyperbook.shareUpdatePreview()",
          },
          children: [],
        },
        {
          type: "text",
          value: ` ${heading.label}`,
        },
      ],
    }));

    const shareDialog: ElementContent[] = [
      {
        type: "element",
        tagName: "dialog",
        properties: {
          id: "share-dialog",
        },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
            },
            children: [
              {
                type: "element",
                tagName: "h2",
                properties: {
                  class: "title",
                },
                children: [
                  {
                    type: "text",
                    value: i18n.get("share-dialog-title"),
                  },
                ],
              },
              {
                type: "element",
                tagName: "label",
                properties: {
                  class: "standalone-option",
                },
                children: [
                  {
                    type: "element",
                    tagName: "input",
                    properties: {
                      type: "checkbox",
                      id: "share-standalone-checkbox",
                      onchange: "hyperbook.shareUpdatePreview()",
                    },
                    children: [],
                  },
                  {
                    type: "text",
                    value: ` ${i18n.get("share-dialog-standalone")}`,
                  },
                ],
              },
              {
                type: "element",
                tagName: "h3",
                properties: {
                  class: "sections-title",
                },
                children: [
                  {
                    type: "text",
                    value: i18n.get("share-dialog-select-sections"),
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "sections-list",
                },
                children: headingCheckboxes,
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "url-preview",
                  id: "share-url-preview",
                },
                children: [
                  {
                    type: "text",
                    value: "",
                  },
                ],
              },
              {
                type: "element",
                tagName: "button",
                properties: {
                  class: "copy-button",
                  onclick: "hyperbook.shareCopyUrl()",
                },
                children: [
                  {
                    type: "text",
                    value: i18n.get("share-dialog-copy-url"),
                  },
                ],
              },
            ],
          },
          {
            type: "element",
            tagName: "button",
            properties: {
              class: "close",
              onclick: "hyperbook.shareClose()",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "close-icon",
                },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    // Add share dialog at the root level, not inside the content
    tree.children = [...originalChildren, ...shareDialog];
  };
};
