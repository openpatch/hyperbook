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
  isCode,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "struktolab";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        const {
          id = hash(node),
          lang = ctx.config.language,
          colorMode = "color",
          fontSize = 14,
          scale = 1,
          src,
          mode = "preview", // "preview" or "edit"
        } = node.attributes || {};

        expectLeafDirective(node, file, name);


        registerDirective(
          file,
          name,
          ["client.js", "struktolab-renderer.umd.js", "struktolab-editor.umd.js"],
          ["style.css"],
          [],
        );

        let webcomponent = "struktolab-renderer";
        if (mode === "edit") {
          webcomponent = "struktolab-editor";
        }

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => ({
            type: "element",
            tagName: "script",
            properties: {
              type: "text/pseudocode",
            },
            children: [
              {
                type: "text",
                value: n.value,
              },
            ],
          }));

        data.hName = "div";
        data.hProperties = {
          class: "directive-struktolab",
        };

        data.hChildren = [
          {
            type: "element",
            tagName: webcomponent,
            properties: {
              lang,
              "color-mode": colorMode,
              "font-size": fontSize,
              "scale": scale,
              "data-id": id,
              src: src
                ? ctx.makeUrl(
                    src as string,
                    "public",
                    ctx.navigation.current || undefined,
                  )
                : undefined,
            },
            children: [...codes],
          },
        ];
      }
    });
  };
};
