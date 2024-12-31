// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import fs from "fs";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
  requestCSS,
  requestJS,
} from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "pyide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const { src = "", id } = node.attributes || {};

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"]);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let srcFile = "";

        if (src) {
          srcFile = fs.readFileSync(
            path.join(ctx.root, "public", String(src)),
            "utf8"
          );
        } else if (node.children?.length > 0) {
          srcFile = toText(node.children);
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-pyide",
          id: id || hash(node)
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
            },
            children: [
              {
                type: "element",
                tagName: "pre",
                properties: {
                  class: "output",
                },
                children: [],
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "editor-container",
            },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  class: "run",
                },
                children: [
                  {
                    type: "text",
                    value: "Run",
                  },
                ],
              },
              {
                type: "element",
                tagName: "code-input",
                properties: {
                  class: "editor",
                  language: "python",
                  template: "pyide-highlighted",
                },
                children: [
                  {
                    type: "raw",
                    value: srcFile,
                  },
                ],
              },
            ],
          },
        ];
      }
    });
  };
};
