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
  const name = "excalidraw";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["client.js", "hyperbook-excalidraw.umd.js"],
          ["style.css", "excalidraw.css"],
          [],
        );

        const {
          aspectRatio = "16/9",
          autoZoom,
          edit,
          src = "",
          onlinkopen,
        } = node.attributes || {};

        data.hName = "div";
        data.hProperties = {
          class: "directive-excalidraw",
          style: `aspect-ratio: ${aspectRatio}`,
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "hyperbook-excalidraw",
            properties: {
              "auto-zoom": autoZoom,
              edit,
              src: ctx.makeUrl(
                src as string,
                "public",
                ctx.navigation.current || undefined,
              ),
              onlinkopen,
            },
            children: [],
          },
        ];
      }
    });
  };
};
