// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Comment, Element, Text } from "hast";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { Raw } from "mdast-util-to-hast";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== "tiles") return;

        const data = node.data || (node.data = {});

        if (node.name === "tiles") {
          expectContainerDirective(node, file, "tiles");
          data.hName = "div";
          data.hProperties = {
            class: "directive-tiles",
          };
          registerDirective(file, "tiles", [], ["style.css"], ["tile"]);

          const tilesChildren: (Text | Comment | Element | Raw)[] = [];
          node.children.filter(isDirective).forEach((node) => {
            if (node.name !== "tile") {
              return;
            }
            const { title, size = "M", icon, href } = node.attributes || {};
            expectLeafDirective(node, file, "tile");

            if (!title) {
              file.fail(
                `[tiles] A title is required (${ctx.navigation.current?.href})`,
                node,
              );
            }

            const tileChildren: (Text | Comment | Element | Raw)[] = [
              {
                type: "element",
                tagName: "a",
                properties: {
                  class: "tile-title",
                  href: href ? ctx.makeUrl(href, "public") : undefined,
                },
                children: [
                  {
                    type: "text",
                    value: title,
                  },
                ],
              },
            ];

            if (icon) {
              tileChildren.push({
                type: "element",
                tagName: "img",
                properties: {
                  class: "tile-icon",
                  src: ctx.makeUrl(icon, "public"),
                },
                children: [],
              });
            }

            tilesChildren.push({
              type: "element",
              tagName: "li",
              properties: {
                class: `tile ${size} ${href ? "link" : ""}`,
              },
              children: tileChildren,
            });
          });

          data.hChildren = [
            {
              type: "element",
              tagName: "ul",
              properties: {
                class: "tiles",
              },
              children: tilesChildren,
            },
          ];
        }
      }
    });
  };
};
