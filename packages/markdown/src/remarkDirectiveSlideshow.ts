// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Element } from "hast";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  findFlat,
  isDirective,
  isImage,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";
import hash from "./objectHash";
import { i18n } from "./i18n";
import { title } from "process";

export default (_: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== "slideshow") return;

        const data = node.data || (node.data = {});
        const { height = "300px", id = hash(node) } = node.attributes || {};

        expectContainerDirective(node, file, "slideshow");
        registerDirective(file, "slideshow", ["client.js"], ["style.css"], []);

        const images = findFlat(node, isImage);

        data.hName = "div";
        data.hProperties = {
          class: "directive-slideshow",
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "slideshow fade",
              style: `height: ${isNaN(Number(height)) ? height : height + "px"}`,
              "data-id": id,
            },
            children: images.map((image, i) => ({
              type: "element",
              tagName: "div",
              properties: {
                class: "image-container",
                "data-index": i,
                "data-id": id,
              },
              children: [toHast(image) as Element],
            })),
          },
          {
            type: "element",
            tagName: "a",
            properties: {
              class: "prev",
              onclick: `hyperbook.slideshow.moveBy('${id}', -1)`,
              title: i18n.get("slideshow-previous"),
            },
            children: [
              {
                type: "raw",
                value: "&#10094;",
              },
            ],
          },
          {
            type: "element",
            tagName: "a",
            properties: {
              class: "next",
              onclick: `hyperbook.slideshow.moveBy('${id}', 1)`,
              title: i18n.get("slideshow-next"),
            },
            children: [
              {
                type: "raw",
                value: "&#10095;",
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "dots-container",
            },
            children: images.map((_, i) => ({
              type: "element",
              tagName: "span",
              properties: {
                class: `dot`,
                "data-index": i,
                "data-id": id,
                onclick: `hyperbook.slideshow.setActive('${id}', ${i})`,
                title: i18n.get("slideshow-jump-to", { index: `${i + 1}` }),
              },
              children: [],
            })),
          },
        ];
      }
    });
  };
};
