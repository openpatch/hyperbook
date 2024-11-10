// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { fromHtml } from "hast-util-from-html";

export default (ctx: HyperbookContext) => () => {
  const qrcode = ctx.config.qrcode || ctx.navigation.current?.qrcode || true;
  return (tree: Root, file: VFile) => {
    const originalChildren = tree.children as ElementContent[];

    if (!qrcode || !ctx.navigation.current?.href) {
      return;
    }

    const qrcodeDialog: ElementContent[] = [
      {
        type: "element",
        tagName: "button",
        properties: {
          id: "qrcode-open",
          onclick: "hyperbook.qrcodeOpen()",
          title: "QR-Code",
        },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "qrcode-icon",
            },
            children: [],
          },
        ],
      },
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
                children: [
                  {
                    type: "text",
                    value: `${ctx.makeUrl(
                      ctx.navigation.current?.href || "",
                      "public",
                    )}`,
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
              onclick: "hyperbook.qrcodeClose()",
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

    if (
      originalChildren[0].type === "element" &&
      originalChildren[0].tagName === "div"
    ) {
      originalChildren[0].children.push(...qrcodeDialog);
    }

    tree.children = originalChildren;
  };
};
