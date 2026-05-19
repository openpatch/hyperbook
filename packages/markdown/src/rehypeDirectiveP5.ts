// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  registerDirective,
  requestJS,
} from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";
import { i18n } from "./i18n";
import { readFile } from "./helper";

interface CodeBundle {
  js?: string;
  scripts?: string[];
}

function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default (ctx: HyperbookContext) => () => {
  const name = "p5";
  const cdnLibraryUrl = ctx.makeUrl(
    path.posix.join("directive-p5", "p5.min.js"),
    "assets",
  );

  const wrapSketch = (sketchCode?: string) => {
    if (sketchCode !== "" && !sketchCode?.includes("setup")) {
      return `
      function setup() {
        createCanvas(100, 100);
        background(200);
        ${sketchCode}
      }`;
    }
    return sketchCode;
  };

  // see https://github.com/processing/p5.js-website/blob/main/src/components/CodeEmbed/frame.tsx
  const makeWrapInMarkupTemplate = (code: CodeBundle) =>
    `<!DOCTYPE html>
<head>
<meta charset="utf8" />
<base href="${ctx.makeUrl("", "public")}" />
<style type='text/css'>
html, body {
  margin: 0;
  padding: 0;
}

canvas {
  display: block;
  margin: 0 auto;
}
</style>
${(code.scripts ? [cdnLibraryUrl, ...code.scripts] : []).map((src) => `<script type="text/javascript" src="${src}"></script>`).join("\n")}
</head>
<body></body>
<script id="code" type="text/javascript">###SLOT###</script>
`;

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (node.type === "element" && node.tagName === "p5") {
        const {
          src = "",
          height,
          editor = false,
          id = hash(node),
        } = node.properties || {};
        const resolvedHeight =
          height !== undefined
            ? typeof height === "number"
              ? `${height}px`
              : `${height}`
            : "calc(100dvh - 80px)";

        let bEditor = editor === "true";

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"]);
        if (bEditor) {
          requestJS(file, ["codemirror", "codemirror.bundle.js"]);
        }

        let srcFile = "";

        if (src) {
          srcFile = readFile(src, ctx) || "";
        } else if (node.children?.length > 0) {
          srcFile = toText(node.children);
        }

        const template = makeWrapInMarkupTemplate({
          scripts: [
            /**
            ctx.makeUrl(
              path.posix.join("directive-p5", "p5.sound.min.js"),
              "assets",
            ),
            */
          ],
        });
        const srcdoc = template
          .replace("###SLOT###", wrapSketch(srcFile))
          .replace(/\u00A0/g, " ");
        node.tagName = "div";
        node.properties = {
          class: ["directive-p5", bEditor ? "" : "standalone"].join(" ").trim(),
          "data-template": template.replace(/\u00A0/g, " "),
          "data-id": id,
          ...(bEditor && height !== undefined
            ? { style: `--p5-height: ${resolvedHeight}` }
            : {}),
        };
        node.children = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
              ...(!bEditor ? { style: `height: ${resolvedHeight};` } : {}),
            },
            children: [
              {
                type: "element",
                tagName: "iframe",
                properties: {
                  srcdoc: srcdoc,
                  loading: "eager",
                  sandbox:
                    "allow-scripts allow-popups allow-modals allow-forms allow-same-origin",
                  "aria-label": i18n.get("p5-code-preview"),
                  title: i18n.get("p5-code-preview"),
                },
                children: [],
              },
            ],
          },
          ...(bEditor
            ? [
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
                            class: "update",
                          },
                          children: [
                            {
                              type: "text",
                              value: i18n.get("p5-update"),
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
                        "data-lang": "javascript",
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
                              value: i18n.get("p5-reset"),
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
                              value: i18n.get("p5-copy"),
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
                              value: i18n.get("p5-download"),
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
              ]
            : []),
        ];
      }
    });
  };
};
