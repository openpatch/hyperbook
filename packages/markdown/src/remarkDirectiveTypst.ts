// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Code, Root, Text } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
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
        const {
          height,
          id = hash(node),
          mode = "preview",
        } = node.attributes || {};
        const data = node.data || (node.data = {});
        const resolvedHeight =
          height !== undefined ? `${height}` : "calc(100dvh - 80px)";

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["codemirror", "codemirror.bundle.js"]);
        requestJS(file, ["uzip", "uzip.js"]);

        const sourceFiles: { filename: string; content: string }[] = [];
        const binaryFiles: { dest: string; url: string }[] = [];
        const fontFiles: { url: string }[] = [];

        // Parse @file and @source directives from text nodes (including nested in paragraphs)
        for (const child of node.children) {
          if (child.type === "text") {
            const text = (child as Text).value;

            // Parse @file directives for binary files
            const fileMatches = text.matchAll(
              /@file\s+dest="([^"]+)"\s+src="([^"]+)"/g,
            );
            for (const match of fileMatches) {
              const dest = match[1];
              const src = match[2];
              const url = ctx.makeUrl(
                src,
                "public",
                ctx.navigation.current || undefined,
              );
              binaryFiles.push({ dest, url });
            }

            // Parse @font directives for font files
            const fontMatches = text.matchAll(
              /@font\s+src="([^"]+)"/g,
            );
            for (const match of fontMatches) {
              const src = match[1];
              // Check if it's a remote URL or local file
              const isRemote = src.startsWith("http://") || src.startsWith("https://");
              const url = isRemote
                ? src
                : ctx.makeUrl(
                    src,
                    "public",
                    ctx.navigation.current || undefined,
                  );
              fontFiles.push({ url });
            }

            // Parse @source directives for typst source files
            const sourceMatches = text.matchAll(
              /@source\s+dest="([^"]+)"\s+src="([^"]+)"/g,
            );
            for (const match of sourceMatches) {
              const dest = match[1];
              const src = match[2];
              const content = readFile(src, ctx) || "";
              sourceFiles.push({ filename: dest, content });
            }
          } else if (child.type === "paragraph") {
            // Reconstruct full text from all children (handles URLs being parsed as links)
            const reconstructText = (node: any): string => {
              if (node.type === "text") return node.value;
              if (node.type === "link") {
                // Reconstruct the original markdown-ish text for links
                // For autolinks like https://..., just return the URL
                return node.url;
              }
              if (node.children) {
                return node.children.map(reconstructText).join("");
              }
              return "";
            };
            const text = child.children.map(reconstructText).join("");

            // Parse @file directives for binary files
            const fileMatches = text.matchAll(
              /@file\s+dest="([^"]+)"\s+src="([^"]+)"/g,
            );
            for (const match of fileMatches) {
              const dest = match[1];
              const src = match[2];
              const url = ctx.makeUrl(
                src,
                "public",
                ctx.navigation.current || undefined,
              );
              binaryFiles.push({ dest, url });
            }

            // Parse @font directives for font files
            const fontMatches = text.matchAll(
              /@font\s+src="([^"]+)"/g,
            );
            for (const match of fontMatches) {
              const src = match[1];
              // Check if it's a remote URL or local file
              const isRemote = src.startsWith("http://") || src.startsWith("https://");
              const url = isRemote
                ? src
                : ctx.makeUrl(
                    src,
                    "public",
                    ctx.navigation.current || undefined,
                  );
              fontFiles.push({ url });
            }

            // Parse @source directives for typst source files
            const sourceMatches = text.matchAll(
              /@source\s+dest="([^"]+)"\s+src="([^"]+)"/g,
            );
            for (const match of sourceMatches) {
              const dest = match[1];
              const src = match[2];
              const content = readFile(src, ctx) || "";
              sourceFiles.push({ filename: dest, content });
            }
          }
        }

        // Find all typ/typst code blocks inside the directive
        const codeBlocks = node.children.filter(
          (n) => n.type === "code" && (n.lang === "typ" || n.lang === "typst"),
        ) as Code[];

        if (codeBlocks.length > 0) {
          // If multiple code blocks exist, use meta for filenames
          for (const codeBlock of codeBlocks) {
            const filename = codeBlock.meta?.trim() || "main.typ";
            // Named file - add to sourceFiles
            sourceFiles.push({
              filename: filename,
              content: codeBlock.value,
            });
          }
        }
        let mainSource = sourceFiles.find(
          (f) => f.filename == "main.typ" || f.filename == "main.typst",
        );
        if (!mainSource && sourceFiles.length > 0) {
          mainSource = sourceFiles[0];
        } else if (!mainSource) {
          mainSource = { filename: "main.typ", content: "" };
        }

        const isEditMode = mode === "edit";
        const isPreviewMode = mode === "preview" || !isEditMode;

        // Get base path from current page directory
        const pagePath = ctx.navigation.current?.path?.directory || "";
        const basePath = ctx.config.basePath || "/";

        data.hName = "div";
        data.hProperties = {
          class: ["directive-typst", isPreviewMode ? "preview-only" : ""]
            .join(" ")
            .trim(),
          "data-id": id,
          "data-source-files": Buffer.from(
            JSON.stringify(sourceFiles),
          ).toString("base64"),
          "data-binary-files": Buffer.from(
            JSON.stringify(binaryFiles),
          ).toString("base64"),
          "data-font-files": Buffer.from(
            JSON.stringify(fontFiles),
          ).toString("base64"),
          "data-base-path": basePath,
          "data-page-path": pagePath,
          ...(height !== undefined && !isPreviewMode
            ? { style: `--typst-height: ${height}` }
            : {}),
        };

        const previewContainer: Element = {
          type: "element",
          tagName: "div",
            properties: {
              class: "preview-container",
              ...(isPreviewMode ? { style: `height: ${resolvedHeight};` } : {}),
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

        const downloadProjectButton: Element = {
          type: "element",
          tagName: "button",
          properties: {
            class: "download-project",
          },
          children: [
            {
              type: "text",
              value: i18n.get("typst-download-project"),
            },
          ],
        };

        const createFullscreenButton = (): Element => ({
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
        });

        if (isEditMode) {
          // Edit mode: show editor and preview side by side
          data.hChildren = [
            previewContainer,
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
                    class: "file-tabs",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "tabs-list",
                      },
                      children: [],
                    },
                    {
                      type: "element",
                      tagName: "button",
                      properties: {
                        class: "add-source-file",
                        title: i18n.get("typst-add-source-file"),
                      },
                      children: [
                        {
                          type: "text",
                          value: "+",
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "details",
                  properties: {
                    class: "binary-files-section",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "summary",
                      properties: {},
                      children: [
                        {
                          type: "element",
                          tagName: "span",
                          properties: {
                            class: "summary-text",
                          },
                          children: [
                            {
                              type: "element",
                              tagName: "span",
                              properties: {
                                class: "summary-indicator",
                              },
                              children: [
                                {
                                  type: "text",
                                  value: "▶",
                                },
                              ],
                            },
                            {
                              type: "text",
                              value: i18n.get("typst-binary-files"),
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "binary-files-list",
                      },
                      children: [],
                    },
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "binary-files-actions",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "button",
                          properties: {
                            class: "add-binary-file",
                            title: i18n.get("typst-add-binary-file"),
                          },
                          children: [
                            {
                              type: "text",
                              value: "+ " + i18n.get("typst-add"),
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "editor typst active",
                    "data-lang": "typst",
                  },
                  children: [
                    {
                      type: "raw",
                      value: htmlEntities(mainSource.content),
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
                    downloadProjectButton,
                    downloadButton,
                    createFullscreenButton(),
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
                class: "buttons bottom",
              },
              children: [downloadProjectButton, downloadButton],
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
                  value: mainSource.content,
                },
              ],
            },
          ];
        }
      }
    });
  };
};
