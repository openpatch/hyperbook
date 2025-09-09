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
import hash from "./objectHash";
import { i18n } from "./i18n";
import { Element } from "hast";

function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default (ctx: HyperbookContext) => () => {
  const name = "webide";

  const makeWrapInMarkupTemplate = () =>
    `<!DOCTYPE html>
<head>
<title>WebIDE</title>
<meta charset="utf8" />
<style type='text/css'>
html, body {
  margin: 0;
  padding: 0;
  background: white;
}
###CSS###
</style>
</head>
<body>###HTML###</body>
<script type="text/javascript">###JS###</script>
`;

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const { height = 400, id = hash(node) } = node.attributes || {};
        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let js = "";
        let css = "";
        let html = "";
        let template = makeWrapInMarkupTemplate();

        let jsNode = node.children.find(
          (n) => n.type === "code" && n.lang === "js",
        ) as Code;
        let cssNode = node.children.find(
          (n) => n.type === "code" && n.lang === "css",
        ) as Code;
        let htmlNode = node.children.find(
          (n) => n.type === "code" && n.lang === "html" && n.meta === null,
        ) as Code;
        let templateNode = node.children.find(
          (n) =>
            n.type === "code" && n.lang === "html" && n.meta === "template",
        ) as Code;

        const buttons: Element[] = [];
        const editors: Element[] = [];

        if (htmlNode) {
          buttons.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "html",
            },
            children: [
              {
                type: "text",
                value: i18n.get("webide-html"),
              },
            ],
          });
          editors.push({
            type: "element",
            tagName: "code-input",
            properties: {
              class: "editor html line-numbers",
              language: "html",
              template: "webide-highlighted",
            },
            children: [
              {
                type: "raw",
                value: htmlEntities(htmlNode.value),
              },
            ],
          });
        }
        if (cssNode) {
          css = cssNode.value;
          buttons.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "css",
            },
            children: [
              {
                type: "text",
                value: i18n.get("webide-css"),
              },
            ],
          });
          editors.push({
            type: "element",
            tagName: "code-input",
            properties: {
              class: "editor css line-numbers",
              language: "css",
              template: "webide-highlighted",
            },
            children: [
              {
                type: "raw",
                value: htmlEntities(css),
              },
            ],
          });
        }
        if (jsNode) {
          js = jsNode.value;
          buttons.push({
            type: "element",
            tagName: "button",
            properties: {
              class: "js",
            },
            children: [
              {
                type: "text",
                value: i18n.get("webide-js"),
              },
            ],
          });
          editors.push({
            type: "element",
            tagName: "code-input",
            properties: {
              class: "editor js line-numbers",
              language: "javascript",
              template: "webide-highlighted",
            },
            children: [
              {
                type: "raw",
                value: htmlEntities(js),
              },
            ],
          });
        }
        if (buttons.length > 0) {
          buttons[0].properties.class += " active";
        }
        if (editors.length > 0) {
          editors[0].properties.class += " active";
        }
        if (templateNode) template = templateNode.value;

        const srcdoc = template
          .replace("###JS###", js)
          .replace("###HTML###", html)
          .replace("###CSS###", css)
          .replace(/\u00A0/g, " ");
        data.hName = "div";
        data.hProperties = {
          class: "directive-webide",
          "data-template": template.replace(/\u00A0/g, " "),
          "data-id": id,
        };
        data.hChildren = [
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
                tagName: "div",
                properties: {
                  class: "container-title",
                },
                children: [
                  {
                    type: "text",
                    value: "",
                  },
                ],
              },
              {
                type: "element",
                tagName: "iframe",
                properties: {
                  srcdoc: srcdoc,
                  loading: "eager",
                  sandbox:
                    "allow-scripts allow-popups allow-modals allow-forms allow-same-origin",
                  "aria-label": i18n.get("webide-code-preview"),
                  title: i18n.get("webide-code-preview"),
                },
                children: [],
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
                children: buttons,
              },
              ...editors,
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
                        value: i18n.get("webide-reset"),
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
                        value: i18n.get("webide-download"),
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
