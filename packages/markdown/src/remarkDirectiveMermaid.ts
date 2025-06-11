// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toString } from "mdast-util-to-string";

export default (ctx: HyperbookContext) => () => {
  const name = "mermaid";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (
        (isDirective(node) && node.name === name) ||
        (node.type === "code" && node.lang === "mermaid")
      ) {
        const data = node.data || (node.data = {});
        node.type = "directive";
        node.lang = "";

        expectContainerDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["mermaid.min.js", "client.js"],
          ["style.css"],
          [],
        );

        const value = node.value || toString(node.children);
        const {} = node.attributes || {};
        data.hName = "pre";
        data.hProperties = {
          class: "directive-mermaid mermaid",
          "data-mermaid": Buffer.from(value).toString("base64"),
        };
        data.hChildren = [
          {
            type: "text",
            value,
          },
        ];
      }
    });
  };
};
