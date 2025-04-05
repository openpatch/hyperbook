// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { isDirective, registerDirective, requestJS } from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "jsxgraph";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const {
          id = hash(node),
          height = 600,
          width = 800,
          boundingbox = [-5, 5, 5, -5],
          keepaspetcratio = false,
          showNavigation = false,
          zoom = true,
          pan = true,
          keyboard = true,
          axis = true,
          grid = true,
        } = node.attributes || {};

        registerDirective(
          file,
          name,
          ["client.js"],
          ["jsxgraph.css", "style.css"]
        );

        requestJS(file, ["directive-jsxgraph", "jsxgraphcore.js"]);

        data.hName = "div";

        data.hProperties = {
          class: "directive-jsxgraph",
          style: `max-height: ${height}px; max-width: ${width}px; aspect-ratio: ${width}/${height};`,
          id: `jsxgraph-${id}`,
        };

        const value = toText(node);
        data.hChildren = [
          {
            type: "element",
            tagName: "script",
            properties: {},
            children: [
              {
                type: "raw",
                value: `
                {
                const board = JXG.JSXGraph.initBoard('jsxgraph-${id}', {
                  boundingbox: ${typeof boundingbox !== "string" ? JSON.stringify(boundingbox) : boundingbox},
                  keepaspectcratio: ${keepaspetcratio},
                  axis: ${axis},
                  showCopyright: false,
                  showNavigation: ${showNavigation},
                  zoom: ${zoom},
                  pan: ${pan},
                  keyboard: ${keyboard},
                  grid: ${grid},
                });

                ${value}
              }
                `,
              },
            ],
          },
        ];
      }
    });
  };
};
