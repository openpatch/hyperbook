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
import { ElementContent } from "hast";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "audio";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const {
          src,
          thumbnail,
          title,
          author,
          position = "left",
        } = node.data.hProperties || {};

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["wavesurfer.min.js", "client.js"],
          ["style.css"],
        );
        const id = hash(node);

        node.attributes = {};
        data.hName = "div";
        data.hProperties = {
          class: "directive-audio",
        };
        const playerChildren: ElementContent[] = [];
        if (position === "left") {
          if (thumbnail && typeof thumbnail === "string") {
            playerChildren.push({
              type: "element",
              tagName: "div",
              properties: {
                class: "thumbnail",
                style: `background-image: url("${ctx.makeUrl(thumbnail, "public")}")`,
              },
              children: [],
            });
          }
          playerChildren.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "play",
              onclick: `hyperbook.audio.togglePlayPause("${id}")`,
            },
            children: [],
          });
        }
        playerChildren.push({
          type: "element",
          tagName: "div",
          properties: {
            class: "wave",
            id,
            "data-src": src,
          },
          children: [],
        });

        if (position === "right") {
          playerChildren.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "play",
              onclick: `hyperbook.audio.togglePlayPause("${id}")`,
            },
            children: [],
          });
          if (thumbnail && typeof thumbnail === "string") {
            playerChildren.push({
              type: "element",
              tagName: "div",
              properties: {
                class: "thumbnail",
                style: `background-image: url("${ctx.makeUrl(thumbnail, "public")}")`,
              },
              children: [],
            });
          }
        }

        const informationChildren: ElementContent[] = [];
        if (title) {
          informationChildren.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "title",
            },
            children: [
              {
                type: "text",
                value: title as string,
              },
            ],
          });
        }
        if (title && author) {
          informationChildren.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "spacer",
            },
            children: [
              {
                type: "text",
                value: " - ",
              },
            ],
          });
        }
        if (author) {
          informationChildren.push({
            type: "element",
            tagName: "span",
            properties: {
              class: "author",
            },
            children: [
              {
                type: "text",
                value: author as string,
              },
            ],
          });
        }
        informationChildren.push({
          type: "element",
          tagName: "span",
          properties: {
            class: "duration",
          },
          children: [
            {
              type: "text",
              value: "",
            },
          ],
        });

        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "player",
            },
            children: playerChildren,
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "information",
            },
            children: informationChildren,
          },
        ];
      }
    });
  };
};
