// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectDirective,
  isDirective,
  registerDirective,
  requestJS,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { i18n } from "./i18n";
import { Element } from "hast";
import {
  collectWorkspace,
  fileActionAttributes,
  cssHeight,
  encodeWorkspace,
  htmlEntities,
  ideBottomButtons,
  ideIconButton,
  ideSplitter,
  requestIdeAssets,
  idePanelHeader,
  idePanelTitle,
} from "./ideWorkspace";

/**
 * A Typst document. `main.typ` is compiled; further `.typ` files can be
 * included, and `::file` adds images, data and (with `font`) fonts. Without
 * `mode="edit"` only the rendered document is shown.
 */
export default (ctx: HyperbookContext) => () => {
  const name = "typst";
  const cdn = elementCdn(ctx.config, name);

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const {
          height,
          id = resolveDirectiveId(file, node),
          mode = "preview",
        } = node.attributes || {};
        const data = node.data || (node.data = {});
        const resolvedHeight = cssHeight(height);
        const isEditMode = mode === "edit";

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestJS(file, ["uzip", "uzip.js"]);
        if (isEditMode) requestIdeAssets(file);

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["typ", "typst"],
          defaultMain: "main.typ",
        });
        const mainFile = workspace.files.find((f) => f.path === workspace.main);

        data.hName = "div";
        data.hProperties = {
          class: isEditMode
            ? "directive-typst ide"
            : "directive-typst ide preview-only",
          "data-id": id,
          ...(cdn
            ? {
                "data-runtime": JSON.stringify({
                  bundle: elementAssetUrl(ctx, name, "typst-bundle.js"),
                  compiler: elementAssetUrl(ctx, name, "typst-compiler.wasm"),
                  renderer: elementAssetUrl(ctx, name, "typst-renderer.wasm"),
                  fonts: elementAssetUrl(ctx, name, "fonts/"),
                }),
              }
            : {}),
          "data-workspace": encodeWorkspace(workspace),
          ...fileActionAttributes(node, file, {
            name,
            defaults: ["create", "upload"],
            accept: ".typ",
          }),
          "data-base-path": ctx.config.basePath || "/",
          "data-page-path": ctx.navigation.current?.path?.directory || "",
          ...(height !== undefined && isEditMode
            ? { style: `--ide-height: ${resolvedHeight}` }
            : {}),
        };

        const previewContainer: Element = {
          type: "element",
          tagName: "div",
          properties: {
            class: isEditMode ? "container preview-container" : "preview-container",
            ...(!isEditMode ? { style: `height: ${resolvedHeight};` } : {}),
          },
          children: [
            ...(isEditMode
              ? [idePanelHeader("", [idePanelTitle("ide-panel-preview")])]
              : []),
            {
              type: "element",
              tagName: "div",
              properties: { class: "typst-loading" },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: { class: "typst-spinner" },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: {},
                  children: [{ type: "text", value: i18n.get("typst-loading") }],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: { class: "typst-preview" },
              children: [],
            },
          ],
        };

        const downloadPdf = ideIconButton(
          "download-pdf",
          "typst-download-pdf",
          "pdf",
        );

        data.hChildren = isEditMode
          ? [
              previewContainer,
              ideSplitter(),
              {
                type: "element",
                tagName: "div",
                properties: { class: "editor-container" },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: { class: "editor typst" },
                    children: [
                      {
                        type: "raw",
                        value: htmlEntities(mainFile?.content ?? ""),
                      },
                    ],
                  },
                  ideBottomButtons([downloadPdf], { filesAsArchive: true }),
                ],
              },
            ]
          : [
              previewContainer,
              {
                type: "element",
                tagName: "div",
                properties: { class: "buttons bottom" },
                children: [
                  ideIconButton(
                    "download-project",
                    "typst-download-project",
                    "archive",
                  ),
                  downloadPdf,
                ],
              },
            ];
      }
    });
  };
};
