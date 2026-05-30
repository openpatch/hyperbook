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

function parsePackagesAttribute(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((pkg) => pkg.trim())
        .filter((pkg) => pkg.length > 0),
    ),
  );
}

export default (ctx: HyperbookContext) => () => {
  const name = "pyide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const { src = "", id = hash(node), packages, height } = node.attributes || {};
        const hasCanvas = "canvas" in (node.attributes || {});
        const packageList = parsePackagesAttribute(packages);

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["python-friendly-error-messages.js", "client.js"], ["style.css"], []);
        requestJS(file, ["codemirror", "codemirror.bundle.js"]);

        let srcFile = "";

        let tests: {
          code: string;
        }[] = [];

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
          ...(hasCanvas ? { "data-canvas": "true" } : {}),
          ...(packageList.length > 0
            ? { "data-packages": packageList.join(",") }
            : {}),
          ...(height ? { style: `--pyide-height: ${height}` } : {}),
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
                  ...(hasCanvas
                    ? [
                        {
                          type: "element",
                          tagName: "button",
                          properties: {
                            class: "canvas-btn",
                          },
                          children: [
                            {
                              type: "text",
                              value: i18n.get("pyide-canvas"),
                            },
                          ],
                        } as ElementContent,
                      ]
                    : []),
                ],
              },
              ...(hasCanvas
                ? [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "canvas-header hidden",
                      },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("pyide-canvas"),
                        },
                      ],
                    } as ElementContent,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "canvas-wrapper hidden",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "canvas",
                          properties: {
                            class: "canvas",
                          },
                          children: [],
                        } as ElementContent,
                      ],
                    } as ElementContent,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "canvas-output-splitter hidden",
                        role: "separator",
                        "aria-label": "Resize canvas and output",
                      },
                      children: [],
                    } as ElementContent,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "output-header hidden",
                      },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("pyide-output"),
                        },
                      ],
                    } as ElementContent,
                  ]
                : []),
              {
                type: "element",
                tagName: "pre",
                properties: {
                  class: "output",
                },
                children: [],
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "splitter",
              role: "separator",
              "aria-label": "Resize panels",
            },
            children: [],
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
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "stop",
                      disabled: true,
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-stop"),
                      },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "editor",
                  "data-lang": "python",
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
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "fullscreen",
                      title: i18n.get("ide-fullscreen-enter"),
                      "aria-label": i18n.get("ide-fullscreen-enter"),
                    },
                    children: [
                      {
                        type: "text",
                        value: "⛶",
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
