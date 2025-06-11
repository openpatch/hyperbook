// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Comment, Element, Text } from "hast";
import { Root } from "mdast";
import { Raw } from "mdast-util-to-hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";

export default (ctx: HyperbookContext) => () => {
  const name = "video";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const { src, title, author, poster } = attributes;

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        const information: (Text | Comment | Element | Raw)[] = [];
        if (title) {
          information.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "title",
            },
            children: [
              {
                type: "text",
                value: title,
              },
            ],
          });
        }
        if (title && author) {
          information.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "spacer",
            },
            children: [
              {
                type: "text",
                value: "-",
              },
            ],
          });
        }
        if (author) {
          information.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "author",
            },
            children: [
              {
                type: "text",
                value: author,
              },
            ],
          });
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-video",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "player",
            },
            children: [
              {
                type: "element",
                tagName: "video",
                properties: {
                  controls: true,
                  src: src
                    ? ctx.makeUrl(
                        src,
                        "public",
                        ctx.navigation.current || undefined,
                      )
                    : undefined,
                  poster: poster
                    ? ctx.makeUrl(
                        poster,
                        "public",
                        ctx.navigation.current || undefined,
                      )
                    : undefined,
                  width: "100%",
                },
                children: [
                  {
                    type: "text",
                    value: "Your browser does not support videos.",
                  },
                ],
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "information",
            },
            children: information,
          },
        ];
      }
    });
  };
};
