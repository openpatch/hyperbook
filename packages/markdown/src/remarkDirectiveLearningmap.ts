// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "learningmap";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["client.js", "hyperbook-learningmap.umd.js"],
          ["style.css", "web-component-learningmap.css"],
          [],
        );

        const { height = "calc(100vh - 80px)", id = hash(node) } =
          node.attributes || {};

        const roadmapData = toText(
          node.children.find((c) => c.type === "code" && c.lang === "yaml"),
        );

        data.hName = "div";
        data.hProperties = {
          class: "directive-learningmap",
          id: `learningmap-${id}`,
          style: `height: ${height}`,
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "hyperbook-learningmap",
            properties: {
              "roadmap-data": roadmapData,
              language: ctx.config.language || "en",
            },
            children: [],
          },
        ];
      }
    });
  };
};
