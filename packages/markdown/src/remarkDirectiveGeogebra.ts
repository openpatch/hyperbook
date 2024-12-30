// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { isDirective, registerDirective } from "./remarkHelper";
import { toText } from "./mdastUtilToText";

export default (ctx: HyperbookContext) => () => {
  const name = "geogebra";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        registerDirective(
          file,
          name,
          [
            "https://www.geogebra.org/apps/deployggb.js",
            "geogebra-web-component.js",
          ],
          ["style.css"],
        );

        const { src, ...props } = node.attributes || {};

        data.hName = "div";
        data.hProperties = {
          class: "directive-geogebra",
        };

        if (!src && !props.width) {
          props.width = "800";
        }

        if (!src && !props.height) {
          props.height = "600";
        }

        const value = toText(node);
        data.hChildren = [
          {
            type: "element",
            tagName: "hyperbook-geogebra",
            properties: {
              ...props,
              borderRadius: 8,
              material: src ? ctx.makeUrl(src, "public") : undefined,
            },
            children: [
              {
                type: "raw",
                value,
              },
            ],
          },
        ];
      }
    });
  };
};
