// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { Element } from "hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectTextDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";

export default (ctx: HyperbookContext) => () => {
  const name = "archive";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectTextDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"]);

        const { name: archiveName = "" } = node.attributes || {};
        data.hName = "a";
        data.hProperties = {
          class: "directive-archive",
          target: "_blank",
          rel: "noopener noreferrer",
          href: ctx.makeUrl(archiveName + ".zip", "archive"),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "icon",
            },
            children: [
              {
                type: "text",
                value: "⏬",
              },
            ],
          },
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "label",
            },
            children: (toHast(node) as Element)?.children,
          },
        ];
      }
    });
  };
};
