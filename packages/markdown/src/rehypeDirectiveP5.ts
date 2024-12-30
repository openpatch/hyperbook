// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import fs from "fs";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  registerDirective,
  requestCSS,
  requestJS,
} from "./remarkHelper";
import { toText } from "./mdastUtilToText";

interface CodeBundle {
  js?: string;
  scripts?: string[];
}

export default (ctx: HyperbookContext) => () => {
  const name = "p5";
  const cdnLibraryUrl = ctx.makeUrl(
    path.posix.join("directive-p5", "p5.min.js"),
    "assets"
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
<body></body>
<script id="code" type="text/javascript">###SLOT###</script>
`.replace(/\u00A0/g, " ");

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (node.type === "element" && node.tagName === "p5") {
        const {
          src = "",
          height = 100,
          editor = false,
        } = node.properties || {};

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"]);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let srcFile = "";

        if (src) {
          srcFile = fs.readFileSync(
            path.join(ctx.root, "public", String(src)),
            "utf8"
          );
        } else if (node.children?.length > 0) {
          srcFile = toText(node.children);
        }

        const template = makeWrapInMarkupTemplate({
          scripts: [
            ctx.makeUrl(
              path.posix.join("directive-p5", "p5.sound.min.js"),
              "assets"
            ),
          ],
        });
        const srcdoc = template.replace("###SLOT###", wrapSketch(srcFile));
        node.tagName = "div";
        node.properties = {
          class: "directive-p5",
          "data-template": template,
        };
        node.children = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
              style: `height: ${height}px;`,
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
                  "aria-label": "Code Preview",
                  title: "Code Preview",
                },
                children: [],
              },
            ],
          },
          ...(editor
            ? [
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    class: "update",
                  },
                  children: [
                    {
                      type: "text",
                      value: "Update",
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "code-input",
                  properties: {
                    class: "editor",
                    language: "javascript",
                  },
                  children: [
                    {
                      type: "raw",
                      value: srcFile,
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
