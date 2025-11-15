// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
  requestCSS,
  requestJS,
} from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";
import { ElementContent } from "hast";
import { i18n } from "./i18n";
import { readFile } from "./helper";

function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default (ctx: HyperbookContext) => () => {
  const name = "pyide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const { src = "", id = hash(node) } = node.attributes || {};

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let srcFile = "";

        let tests: {
          code: string;
        }[] = [];

        let input = "";

        if (src) {
          srcFile = readFile(src, ctx) || "";
        } else if (node.children?.length > 0) {
          tests = node.children
            .filter((c) => c.type === "code")
            .filter((c) => (c as Code).meta?.includes("test"))
            .map((c, i) => ({
              code: (c as Code).value,
              name: `${i}`,
            }));
          input = toText(
            node.children.find(
              (c) => c.type === "code" && c.lang === "input",
            ) as Code,
          );
          srcFile = toText(
            node.children.find(
              (c) =>
                c.type === "code" &&
                c.lang === "python" &&
                !(c as Code).meta?.includes("test"),
            ) as Code,
          );
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-pyide",
          id: id,
          "data-tests": Buffer.from(JSON.stringify(tests)).toString("base64"),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "buttons",
                },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "output-btn active",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-output"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "input-btn",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-input"),
                      },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "pre",
                properties: {
                  class: "output",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "code-input",
                properties: {
                  class: "input hidden",
                },
                children: [
                  {
                    type: "raw",
                    value: input || "",
                  },
                ],
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "editor-container",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "buttons",
                },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "run",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-run"),
                      },
                    ],
                  },
                  ...(tests.length > 0
                    ? [
                        {
                          type: "element",
                          tagName: "button",
                          properties: {
                            class: "test",
                          },
                          children: [
                            {
                              type: "text",
                              value: i18n.get("pyide-test"),
                            },
                          ],
                        } as ElementContent,
                      ]
                    : []),
                ],
              },
              {
                type: "element",
                tagName: "code-input",
                properties: {
                  class: "editor line-numbers",
                  language: "python",
                  template: "pyide-highlighted",
                },
                children: [
                  {
                    type: "raw",
                    value: htmlEntities(srcFile),
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "buttons bottom",
                },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "reset",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-reset"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "copy",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-copy"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "download",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-download"),
                      },
                    ],
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
