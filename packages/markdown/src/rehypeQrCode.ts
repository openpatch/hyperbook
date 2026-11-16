// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";

/** Whether the page offers its QR code (the header's button and the dialog
 * it opens). */
export const qrcodeEnabled = (ctx: HyperbookContext) =>
  !!ctx.config.qrcode &&
  (ctx.navigation.current?.qrcode ?? true) &&
  !!ctx.navigation.current?.href;

/**
 * The page's QR code: the dialog here, its button in the header
 * (rehypeShell).
 */
export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const originalChildren = tree.children as ElementContent[];

    if (!qrcodeEnabled(ctx) || !ctx.navigation.current) {
      return;
    }

    const urls: ElementContent[] = [
      {
        type: "element",
        tagName: "div",
        properties: {
          "data-href": `${ctx.makeUrl(ctx.navigation.current?.href || "", "public")}`,
        },
        children: [],
      },
    ];

    if (ctx.navigation.current.permaid) {
      urls.push({
        type: "element",
        tagName: "div",
        properties: {
          "data-href": `${ctx.makeUrl(["/", "@", ctx.navigation.current.permaid || ""], "public")}`,
        },
        children: [],
      });
    }

    const qrcodeDialog: ElementContent[] = [
      {
        type: "element",
        tagName: "dialog",
        properties: {
          id: "qrcode-dialog",
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
                tagName: "div",
                properties: {
                  class: "name",
                },
                children: [
                  {
                    type: "text",
                    value: ctx.navigation.current.name || ctx.config.name,
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "make-qrcode",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "url",
                },
                children: urls,
              },
            ],
          },
          {
            type: "element",
            tagName: "button",
            properties: {
              class: "close",
              onclick: "hyperbook.qrcode.close()",
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

    const qrcodeDialogElement = qrcodeDialog[0];

    // Add dialog at root level so it's not hidden when sections are filtered
    tree.children = [...originalChildren, qrcodeDialogElement];
  };
};
