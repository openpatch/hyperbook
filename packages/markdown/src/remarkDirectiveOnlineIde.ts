// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isCode,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "onlineide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const {
          height = ctx.config.elements?.onlineide?.height || "600px",
          fileList = true,
          console: con = true,
          pCode = false,
          libraries = "",
          bottomPanel = true,
          errorList = true,
          speed = 1000,
          id = hash(node),
        } = attributes;

        expectContainerDirective(node, file, name);
        registerDirective(
          file,
          name,
          [
            "client.js",
            {
              type: "module",
              crossorigin: true,
              src: "include/online-ide-embedded.js",
              position: "head",
              versioned: false
            },
          ],
          ["style.css", "include/online-ide-embedded.css"],
          [],
        );

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => ({
            type: "element",
            tagName: "script",
            properties: {
              type: "text/plain",
              title: n.meta,
              "data-type":
                n.lang === "md" || n.lang === "markdown" ? "hint" : "java",
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
          class: "directive-onlineide",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "java-online",
              style: `height: ${height}; padding: 0; margin: 0;`,
              "data-java-online": `{'id': '${id}', 'speed': ${speed}, 'withBottomPanel': ${bottomPanel},'withPCode': ${pCode},'withConsole': ${con},'withFileList': ${fileList},'withErrorList': ${errorList}, 'libraries': [${libraries?.split(",").map((lib) => `'${lib.trim()}'`)}]}`,
            },
            children: [...codes],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "menu",
            },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  onclick: "hyperbook.onlineide.openFullscreen(this)",
                },
                children: [
                  {
                    type: "text",
                    value: "Fullscreen",
                  },
                ],
              },
            ],
          },
        ];
      }
    });
  };
};
