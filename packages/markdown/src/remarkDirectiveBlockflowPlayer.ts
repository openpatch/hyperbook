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

export default (ctx: HyperbookContext) => () => {
  const name = "blockflow-player";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const {
          src,
          width = "100%",
          height = "600px",
          aspectRatio = "4/3",
        } = node.attributes || {};

        const siteSrc = ctx.makeUrl(src || "", "public", ctx.navigation.current || undefined);

        const iframeSrc = src
          ? `https://blockflow.openpatch.org/player.html?project=${encodeURIComponent(siteSrc)}`
          : undefined;

        data.hName = "div";
        data.hProperties = {
          class: "directive-blockflow-player",
          style: `aspect-ratio: ${aspectRatio}; height: ${height}; width: ${width}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src: iframeSrc,
              allowfullscreen: true,
            },
            children: [],
          },
        ];
      }
    });
  };
};
