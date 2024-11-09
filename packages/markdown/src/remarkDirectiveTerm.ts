// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectTextDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== "term" && node.name !== "t") return;

        expectTextDirective(node, file, "term");

        if (node.children[0]?.type !== "text") {
          file.fail(
            `[term] Only plain text is supported, use :term[my text]{#my-id} (${ctx.navigation.current?.href})`,
            node,
          );
        }
        registerDirective(file, "term", [], ["style.css"]);

        const value = node.children[0].value;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        let {
          id = value.toLowerCase().replaceAll(" ", "-"),
          class: className,
        } = attributes;

        let anchor = "";
        if (className) {
          anchor = "#" + className;
        }

        const href = ctx.makeUrl(`${id}${anchor}`, "glossary");

        data.hName = "a";
        data.hProperties = {
          href: href,
        };
        data.hChildren = [
          {
            type: "text",
            value: value,
          },
        ];
      }
    });
  };
};
