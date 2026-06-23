// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "kiri";

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const {
          src = "",
          device = "",
          mode = "FDM",
          id = hash(node),
          height = "500px",
          width = "100%",
        } = node.attributes || {};
        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        // Resolve model URL - if relative, make it absolute
        let modelUrl = src || "";
        if (src && !src.startsWith("http://") && !src.startsWith("https://")) {
          modelUrl = ctx.makeUrl(src, "public", ctx.navigation.current ?? undefined) ?? src;
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-kiri",
          "data-id": id,
          "data-src": modelUrl,
          "data-mode": mode,
          "data-device": device,
          "data-height": height,
          "data-width": width,
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              class: "kiri-iframe",
              id: `kiri-frame-${id}`,
              src: "https://grid.space/kiri",
              frameborder: "0",
              allowfullscreen: true,
              style: `width: ${width}; height: ${height}; border: none;`,
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "kiri-status",
            },
            children: [
              {
                type: "text",
                value: "Loading Kiri:Moto...",
              },
            ],
          },
        ];
      }
    });
  };
};
