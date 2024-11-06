// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import QRCode from "qrcode-svg";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";

const realSizes = {
  S: 64,
  M: 128,
  L: 256,
  XL: 512,
} as const;

export default (ctx: HyperbookContext) => () => {
  const name = "qr";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"]);

        const { value = "", size = "M", label } = node.attributes || {};

        const safeSize: "S" | "M" | "L" | "XL" = size as any;
        const qr = new QRCode({
          content: value as string,
          padding: 0,
          width: realSizes[safeSize],
          height: realSizes[safeSize],
          color: "#000000",
          background: "#ffffff",
          ecl: "M",
        }).svg();

        const labelElement: ElementContent[] = [];
        if (label) {
          labelElement.push({
            type: "element",
            tagName: "div",
            properties: {
              class: ["label", size].join(" "),
              style: `max-width: ${safeSize}px`,
            },
            children: [
              {
                type: "text",
                value: label,
              },
            ],
          });
        }
        data.hName = "div";
        data.hProperties = {
          class: "directive-qr",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: ["code", size].join(" "),
            },
            children: [
              {
                type: "raw",
                value: qr,
              },
            ],
          },
          ...labelElement,
        ];
      }
    });
  };
};
