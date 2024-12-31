// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { toString } from "mdast-util-to-string";
import {
  expectContainerDirective,
  registerDirective,
  requestCSS,
  requestJS,
} from "./remarkHelper";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "abc-music";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (
        (node.type === "code" && node.lang === "abcjs")
      ) {
        const data = node.data || (node.data = {});
        node.type = "directive";
        node.lang = "";

        expectContainerDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["abcjs-basic-min.js", "client.js"],
          ["style.css"]
        );
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        const value = node.value || toString(node.children);
        const editor = node.meta?.includes("editor");

        data.hName = "div";
        data.hProperties = {
          class: "directive-abc-music",
          "data-tune": Buffer.from(value).toString("base64"),
          "data-editor": editor ? "true" : "false",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "tune",
            },
            children: [
            ],
          },
          ...(editor
            ? [
                {
                  type: "element",
                  tagName: "code-input",
                  properties: {
                    class: "editor",
                    id: hash(node),
                    template: "abc-highlighted",
                    language: "javascript"
                  },
                  children: [
                    {
                      type: "raw",
                      value: value,
                    }
                  ]
                },
              ]
            : []),
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "player",
            },
          },
        ];
      }
    });
  };
};
