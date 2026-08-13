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

        // Check the form before the retype below: once node.type is
        // "directive" there is no leaf/container distinction left to inspect.
        // A ```mermaid fence has no colon count, so it is exempt.
        if (isDirective(node)) {
          expectContainerDirective(node, file, name);
        }

        node.type = "directive";
        node.lang = "";
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
