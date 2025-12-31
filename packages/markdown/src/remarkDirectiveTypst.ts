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
import { Element, ElementContent } from "hast";
import { readFile } from "./helper";

function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default (ctx: HyperbookContext) => () => {
  const name = "typst";

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const { height, id = hash(node), mode = "preview", src = "" } = node.attributes || {};
        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["code-input", "code-input.min.js"]);
        requestCSS(file, ["code-input", "code-input.min.css"]);
        requestJS(file, ["code-input", "auto-close-brackets.min.js"]);
        requestJS(file, ["code-input", "indent.min.js"]);

        let typstCode = "";

        // Load from external file if src is provided
        if (src) {
          typstCode = readFile(src, ctx) || "";
        } else {
          // Find typst code block inside the directive
          const typstNode = node.children.find(
            (n) => n.type === "code" && (n.lang === "typ" || n.lang === "typst"),
          ) as Code;

          if (typstNode) {
            typstCode = typstNode.value;
          }
        }

        const isEditMode = mode === "edit";
        const isPreviewMode = mode === "preview" || !isEditMode;

        // Determine container height based on mode and custom height
        let containerHeight: string;
        if (height) {
          // Custom height provided - use as-is if string, add px if number
          containerHeight = typeof height === "number" || /^\d+$/.test(height) ? `${height}px` : height;
        } else {
          // Default heights: auto for preview, calc(100dvh - 128px) for edit
          containerHeight = isPreviewMode ? "auto" : "calc(100dvh - 128px)";
        }

        data.hName = "div";
        data.hProperties = {
          class: ["directive-typst", isPreviewMode ? "preview-only" : ""].join(" ").trim(),
          "data-id": id,
        };

        const previewContainer: Element = {
          type: "element",
          tagName: "div",
          properties: {
            class: "preview-container",
            style: `height: ${containerHeight};`,
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "typst-loading",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "typst-spinner",
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: {},
                  children: [
                    {
                      type: "text",
                      value: i18n.get("typst-loading"),
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "typst-preview",
              },
              children: [],
            },
          ],
        };

        const downloadButton: Element = {
          type: "element",
          tagName: "button",
          properties: {
            class: "download-pdf",
          },
          children: [
            {
              type: "text",
              value: i18n.get("typst-download-pdf"),
            },
          ],
        };

        const copyButton: Element = {
          type: "element",
          tagName: "button",
          properties: {
            class: "copy",
          },
          children: [
            {
              type: "text",
              value: i18n.get("typst-copy"),
            },
          ],
        };

        if (isEditMode) {
          // Edit mode: show editor and preview side by side
          data.hChildren = [
            previewContainer,
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
                        class: "typst",
                      },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("typst-code"),
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "code-input",
                  properties: {
                    class: "editor typst active line-numbers",
                    language: "typst",
                    template: "typst-highlighted",
                  },
                  children: [
                    {
                      type: "raw",
                      value: htmlEntities(typstCode),
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
                          value: i18n.get("typst-reset"),
                        },
                      ],
                    },
                    copyButton,
                    downloadButton,
                  ],
                },
              ],
            },
          ];
        } else {
          // Preview mode: show only preview with download button
          data.hChildren = [
            previewContainer,
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "buttons-container",
              },
              children: [copyButton, downloadButton],
            },
            {
              type: "element",
              tagName: "textarea",
              properties: {
                class: "typst-source hidden",
                style: "display: none;",
              },
              children: [
                {
                  type: "text",
                  value: typstCode,
                },
              ],
            },
          ];
        }
      }
    });
  };
};
