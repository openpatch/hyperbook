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
          url = ctx.config.elements?.onlineide?.url ||
            "https://onlineide.openpatch.org",
          height = ctx.config.elements?.onlineide?.height || "600px",
          fileList = true,
          console: con = true,
          pCode = false,
          bottomPanel = true,
          errorList = true,
          speed = 1000,
          id = hash(node),
        } = attributes;

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"]);

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => ({
            type: "element",
            tagName: "script",
            properties: {
              type: "plain/text",
              title: n.meta,
              "data-type":
                n.lang === "md" || n.lang === "markdown" ? "hint" : undefined,
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
            tagName: "iframe",
            properties: {
              class: "player",
              srcdoc: `<script>window.jo_doc = window.frameElement.textContent;</script><script src='${url}/includeIDE.js'></script>`,
              frameBorder: "0",
              height: height,
            },
            children: [
              {
                type: "raw",
                value: `{'id': '${id}', 'speed': ${speed}, 'withBottomPanel': ${bottomPanel},'withPCode': ${pCode},'withConsole': ${con},'withFileList': ${fileList},'withErrorList': ${errorList}}`,
              },
              ...codes,
              {
                type: "element",
                tagName: "style",
                properties: {},
                children: [
                  {
                    type: "raw",
                    value: `
.joe_javaOnlineDiv {
  box-shadow: none;
  margin: 0!important;
  top: 0!important;
  width: 100%!important;
  height: calc(100% - 5px) !important;
  border: none !important;
}
`,
                  },
                ],
              },
            ],
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
