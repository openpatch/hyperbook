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
import { readFile } from "./helper";

function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default (ctx: HyperbookContext) => () => {
  const name = "openscad";

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const { src = "", id = hash(node), height, library } = node.attributes || {};
        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let source = "";
        if (src) {
          source = readFile(src, ctx) || "";
        } else {
          source =
            (
              node.children.find(
                (c) =>
                  c.type === "code" &&
                  ((c as Code).lang === "scad" || (c as Code).lang === "openscad"),
              ) as Code
            )?.value || "";
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-openscad",
          "data-id": id,
          ...(height ? { style: `--openscad-height: ${height}` } : {}),
          ...(library ? { "data-library": library } : {}),
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: { class: "left-side" },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { class: "preview-container" },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "preview-header" },
                    children: [{ type: "text", value: i18n.get("openscad-preview") }],
                  },
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "canvas-wrapper" },
                    children: [
                      {
                        type: "element",
                        tagName: "canvas",
                        properties: { class: "preview-canvas" },
                        children: [],
                      },
                      {
                        type: "element",
                        tagName: "div",
                        properties: { class: "canvas-overlay hidden" },
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "canvas-params-splitter hidden",
                  role: "separator",
                  "aria-label": "Resize canvas and parameters",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "div",
                properties: { class: "parameters-panel hidden" },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "parameters-header" },
                    children: [{ type: "text", value: i18n.get("openscad-parameters") }],
                  },
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "parameters-body" },
                    children: [],
                  },
                ],
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
            properties: { class: "editor-container" },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { class: "buttons" },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: { class: "render" },
                    children: [{ type: "text", value: i18n.get("openscad-render") }],
                  },
                ],
              },
              {
                type: "element",
                tagName: "code-input",
                properties: {
                  class: "editor line-numbers",
                  language: "clike",
                  template: "openscad-highlighted",
                },
                children: [{ type: "raw", value: htmlEntities(source) }],
              },
              {
                type: "element",
                tagName: "textarea",
                properties: {
                  class: "parameters",
                  placeholder: '{"size": 20, "height": 10}',
                },
                children: [{ type: "text", value: "{}" }],
              },
              {
                type: "element",
                tagName: "div",
                properties: { class: "buttons bottom" },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: { class: "copy" },
                    children: [{ type: "text", value: i18n.get("openscad-copy") }],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: { class: "download-stl" },
                    children: [{ type: "text", value: i18n.get("openscad-download-stl") }],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: { class: "reset" },
                    children: [{ type: "text", value: i18n.get("openscad-reset") }],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "fullscreen",
                      title: i18n.get("ide-fullscreen-enter"),
                      "aria-label": i18n.get("ide-fullscreen-enter"),
                    },
                    children: [{ type: "text", value: "⛶" }],
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
