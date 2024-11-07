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

export default (_: HyperbookContext) => () => {
  const name = "youtube";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const { id } = attributes;

        expectLeafDirective(node, file, name);

        if (id == null) {
          file.fail(`Missing id, use ::youtube{#iasd}`, node);
        }

        registerDirective(file, name, [], ["style.css"]);

        data.hName = "div";
        data.hProperties = {
          class: "directive-youtube",
          id: `video-${id}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              class: "player",
              src: "https://www.youtube.com/embed/" + id,
              frameBorder: "0",
              title: typeof data.hChildren === "string" ? data.hChildren : "",
              allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
            },
            children: [],
          },
        ];
      }
    });
  };
};
