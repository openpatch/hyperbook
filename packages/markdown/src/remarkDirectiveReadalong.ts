// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { ElementContent } from "hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { remark } from "./process";
import hash from "./objectHash";
import { toText as mdastToText } from "./mdastUtilToText";

export default (ctx: HyperbookContext) => () => {
  const name = "readalong";

  const readalongNodes: (
    | TextDirective
    | ContainerDirective
    | LeafDirective
  )[] = [];

  return async (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;
        readalongNodes.push(node);
        return;
      }
    });

    for (const node of readalongNodes) {
      const data = node.data || (node.data = {});
      const {
        src,
        timestamps,
        autoGenerate = false,
        speed = 150, // words per minute for auto-generation
        mode = "manual", // "manual" or "tts"
      } = node.attributes || {};

      expectContainerDirective(node, file, name);
      registerDirective(file, name, ["client.js"], ["style.css"], []);

      const id = hash(node);

      node.attributes = {};
      data.hName = "div";
      data.hProperties = {
        class: "directive-readalong",
        "data-id": id,
      };

      // Process children to get content
      const contentChildren: ElementContent[] = [];
      for (const child of node.children) {
        const processedChild = await remark(ctx).run(child);
        contentChildren.push(processedChild as ElementContent);
      }

      // Extract text for auto-generation before creating HAST (more efficient)
      const textContent = mdastToText(node.children);

      // Create a wrapper for the text content
      const textWrapper: ElementContent = {
        type: "element",
        tagName: "div",
        properties: {
          class: "readalong-text",
          "data-id": id,
        },
        children: contentChildren,
      };
      
      // Parse timestamps if provided
      let timestampData = null;
      if (timestamps && typeof timestamps === "string") {
        try {
          timestampData = JSON.parse(timestamps);
        } catch (e) {
          // Invalid JSON, ignore
        }
      }

      // Build controls
      const controls: ElementContent = {
        type: "element",
        tagName: "div",
        properties: {
          class: "readalong-controls",
        },
        children: [
          {
            type: "element",
            tagName: "button",
            properties: {
              class: "play-pause",
              onclick: `hyperbook.readalong.togglePlayPause("${id}")`,
              title: "Play/Pause",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "time-display",
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: {
                  class: "current-time",
                },
                children: [{ type: "text", value: "0:00" }],
              },
              {
                type: "text",
                value: " / ",
              },
              {
                type: "element",
                tagName: "span",
                properties: {
                  class: "total-time",
                },
                children: [{ type: "text", value: "0:00" }],
              },
            ],
          },
        ],
      };

      // Build children array - audio element only for manual mode
      const children: ElementContent[] = [controls, textWrapper];
      
      if (mode !== "tts") {
        children.push({
          type: "element",
          tagName: "audio",
          properties: {
            class: "readalong-audio",
            src: src
              ? ctx.makeUrl(
                  src as string,
                  "public",
                  ctx.navigation.current || undefined,
                )
              : undefined,
            preload: "metadata",
          },
          children: [],
        });
      }
      
      children.push({
        type: "element",
        tagName: "script",
        properties: {
          type: "application/json",
          class: "readalong-config",
        },
        children: [
          {
            type: "text",
            value: JSON.stringify({
              id,
              mode: mode || "manual",
              timestamps: timestampData,
              autoGenerate: autoGenerate === "true",
              speed: typeof speed === "string" ? parseInt(speed) : speed,
              text: textContent,
            }),
          },
        ],
      });

      data.hChildren = children;
    }
  };
};
