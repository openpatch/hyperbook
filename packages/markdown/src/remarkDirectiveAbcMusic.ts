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

        console.log(node)
        const value = node.value || toString(node.children);
        const editor = node.meta?.includes("editor");

        console.log(editor);
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
              {
                type: "text",
                value,
              },
            ],
          },
          ...(editor
            ? [
                {
                  type: "element",
                  tagName: "textarea",
                  properties: {
                    class: "editor",
                    id: hash(node),
                    spellcheck: "false",
                  },
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
