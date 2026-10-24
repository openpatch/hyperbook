// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { Element } from "hast";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { i18n } from "./i18n";
import {
  collectWorkspace,
  compareAttributes,
  fileActionAttributes,
  cssHeight,
  encodeWorkspace,
  htmlEntities,
  ideBottomButtons,
  idePanelHeader,
  idePanelTitle,
  ideSplitter,
  requestIdeAssets,
} from "./ideWorkspace";

/**
 * A p5.js sketch. `sketch.js` is the main file; further JavaScript files are
 * loaded before it, in the order they are written. Without `mode="editor"`
 * only the running sketch is shown.
 */
export default (ctx: HyperbookContext) => () => {
  const name = "p5";
  const libraryUrl = ctx.makeUrl(
    path.posix.join("directive-p5", "p5.min.js"),
    "assets",
  );

  // see https://github.com/processing/p5.js-website/blob/main/src/components/CodeEmbed/frame.tsx
  const template = `<!DOCTYPE html>
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
<script type="text/javascript" src="${libraryUrl}"></script>
</head>
<body></body>
###SCRIPTS###
`;

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const {
          height,
          mode = "preview",
          id = resolveDirectiveId(file, node),
        } = node.attributes || {};
        const data = node.data || (node.data = {});
        const isEditor = mode === "editor";
        const resolvedHeight = cssHeight(height);

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(file, name, ["client.js"], ["style.css"]);
        if (isEditor) requestIdeAssets(file);

        if (node.attributes?.src || "editor" in (node.attributes || {})) {
          file.message(
            'p5 now takes its sketch from ::file{path="sketch.js" src="…"} and mode="editor". Run `hyperbook migrate` to convert the page.',
            node,
          );
        }

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["js", "javascript"],
          defaultMain: "sketch.js",
        });
        const mainFile = workspace.files.find((f) => f.path === workspace.main);
        // Only an editor has something of the reader's to compare.
        const compare = isEditor
          ? compareAttributes(node, file, workspace, name)
          : {};

        data.hName = "div";
        data.hProperties = {
          class: isEditor ? "directive-p5 ide" : "directive-p5 standalone",
          "data-template": template,
          "data-id": id,
          "data-workspace": encodeWorkspace(workspace),
          ...fileActionAttributes(node, file, { name, accept: ".js" }),
          ...compare,
          ...(isEditor && height !== undefined
            ? { style: `--ide-height: ${resolvedHeight}` }
            : {}),
        };

        const sketch: Element = {
          type: "element",
          tagName: "iframe",
          properties: {
            loading: "eager",
            sandbox: [
              "allow-scripts",
              "allow-popups",
              "allow-modals",
              "allow-forms",
              "allow-same-origin",
            ],
            "aria-label": i18n.get("p5-code-preview"),
            title: i18n.get("p5-code-preview"),
          },
          children: [],
        };

        const preview: Element = {
          type: "element",
          tagName: "div",
          properties: {
            class: "container",
            ...(!isEditor ? { style: `height: ${resolvedHeight};` } : {}),
          },
          children: [
            ...(isEditor
              ? [idePanelHeader("", [idePanelTitle("ide-panel-preview")])]
              : []),
            // With compare, the target is laid over the sketch's frame.
            compare["data-compare"]
              ? {
                  type: "element",
                  tagName: "div",
                  properties: { class: "p5-frame" },
                  children: [sketch],
                }
              : sketch,
          ],
        };

        data.hChildren = isEditor
          ? [
              preview,
              ideSplitter(),
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
                        properties: { class: "update" },
                        children: [
                          { type: "text", value: i18n.get("p5-update") },
                        ],
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "editor" },
                    children: [
                      {
                        type: "raw",
                        value: htmlEntities(mainFile?.content ?? ""),
                      },
                    ],
                  },
                  ideBottomButtons(),
                ],
              },
            ]
          : [preview];
      }
    });
  };
};
