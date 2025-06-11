// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { Element } from "hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  expectTextDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "protect";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const {
          password = "",
          description = "",
          id = hash(node),
        } = node.attributes || {};
        data.hName = "div";
        data.hProperties = {
          class: "directive-protect",
          "data-id": id,
          "data-toast": Buffer.from(password as string).toString("base64"),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "hidden",
            },
            children: (
              toHast(node, {
                allowDangerousHtml: ctx.config.allowDangerousHtml || false,
              }) as Element
            )?.children,
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "password-input",
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: {
                  class: "description",
                },
                children: [
                  {
                    type: "text",
                    value: description as string,
                  },
                ],
              },
              {
                type: "element",
                tagName: "span",
                properties: {
                  class: "icon",
                },
                children: [
                  {
                    type: "text",
                    value: "🔒",
                  },
                ],
              },
              {
                type: "element",
                tagName: "input",
                properties: {
                  placeholder: "...",
                  type: "password",
                  "data-id": id,
                },
                children: [],
              },
            ],
          },
        ];
      }
    });
  };
};
