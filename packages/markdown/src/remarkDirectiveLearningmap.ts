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
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";
import * as yaml from "js-yaml";

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
          node.children.find(
            (c) =>
              c.type === "code" && (c.lang === "yaml" || c.lang === "json"),
          ),
        );

        let parsedRoadmapData: {
          background?: {
            image?: { src: string };
          };
          nodes?: {
            video?: string;
            resources: { url: string }[];
          }[];
        };

        try {
          parsedRoadmapData = JSON.parse(roadmapData) as any;
        } catch {
          try {
            parsedRoadmapData = yaml.load(roadmapData) as any;
          } catch (err) {
            console.error("Failed to parse roadmap data:", err);
            return SKIP;
          }
        }

        if (parsedRoadmapData.background?.image?.src) {
          const url = ctx.makeUrl(
            parsedRoadmapData.background.image.src,
            "public",
            ctx.navigation.current || undefined,
          );
          parsedRoadmapData.background.image.src = url;
        }

        parsedRoadmapData.nodes?.forEach((node) => {
          if (node.video) {
            node.video = ctx.makeUrl(node.video, "public");
          }
          if (node.resources) {
            node.resources = node.resources.map((res) => ({
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
