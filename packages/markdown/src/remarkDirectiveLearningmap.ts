// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import hash from "./objectHash";
import { readFile } from "./helper";

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
          ["client.js", "learningmap.umd.js"],
          ["style.css", "web-component-learningmap.css"],
          [],
        );

        const {
          height = "calc(100vh - 80px)",
          id = hash(node),
          src = "",
        } = node.attributes || {};

        if (!src) return SKIP;

        let srcFile = readFile(src, ctx);
        if (!srcFile) {
          file.message(`File not found: ${src}`, node);
          return SKIP;
        }

        let parsedRoadmapData = JSON.parse(srcFile) as any;
        parsedRoadmapData.nodes?.forEach((node: any) => {
          if (node.video) {
            node.video = ctx.makeUrl(node.video, "public");
          }
          if (node.resources) {
            node.resources = node.resources.map((res: any) => ({
              ...res,
              url: ctx.makeUrl(res.url, "public"),
            }));
          }
        });

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
              "roadmap-data": JSON.stringify(parsedRoadmapData),
              language: ctx.config.language || "en",
            },
            children: [],
          },
        ];
      }
    });
  };
};
