// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  const qrcode = ctx.config.qrcode && (ctx.navigation.current?.qrcode ?? true);
  return (tree: Root, file: VFile) => {
    const originalChildren = tree.children as ElementContent[];

    if (!qrcode || !ctx.navigation.current?.href) {
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
        tagName: "button",
        properties: {
          id: "qrcode-open",
          onclick: "hyperbook.qrcodeOpen()",
          title: i18n.get("qr-code"),
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
                children: urls,
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

    // Add QR code button to floating buttons container, dialog goes at root level
    const qrcodeButton = qrcodeDialog[0]; // The button
    const qrcodeDialogElement = qrcodeDialog[1]; // The dialog element
    
    if (
      originalChildren[0].type === "element" &&
      originalChildren[0].tagName === "div"
    ) {
      // Find the floating buttons container and add the QR button to it
      const floatingContainer = originalChildren[0].children.find(
        (child: any) => child.type === "element" && child.properties?.id === "floating-buttons-container"
      );
      
      if (floatingContainer && floatingContainer.type === "element") {
        floatingContainer.children.push(qrcodeButton);
      } else {
        // Fallback: add directly to content if container not found
        originalChildren[0].children.push(qrcodeButton);
      }
    }

    // Add dialog at root level so it's not hidden when sections are filtered
    tree.children = [...originalChildren, qrcodeDialogElement];
  };
};
