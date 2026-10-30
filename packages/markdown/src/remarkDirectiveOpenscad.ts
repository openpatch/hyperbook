// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn, hostedRuntime } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { i18n } from "./i18n";
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

export default (ctx: HyperbookContext) => () => {
  const name = "openscad";
  const cdn = elementCdn(ctx.config, name, hostedRuntime(ctx, name));

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const {
          id = resolveDirectiveId(file, node),
          height,
          library,
        } = node.attributes || {};
        const data = node.data || (node.data = {});

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestIdeAssets(file);

        if (node.attributes?.src) {
          file.message(
            'openscad no longer reads src="…"; load the file with ::file{path="main.scad" src="…"} inside the directive. Run `hyperbook migrate` to convert the page.',
            node,
          );
        }

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["scad", "openscad"],
          defaultMain: "main.scad",
        });
        const source =
          workspace.files.find((f) => f.path === workspace.main)?.content ?? "";

        data.hName = "div";
        data.hProperties = {
          class: "directive-openscad ide",
          "data-id": id,
          ...(cdn
            ? { "data-runtime-base": elementAssetUrl(ctx, name, "") }
            : {}),
          "data-workspace": encodeWorkspace(workspace),
          // Models import meshes and fonts, so readers bring their own.
          ...fileActionAttributes(node, file, {
            name,
            defaults: ["upload"],
            accept: ".scad",
          }),
          "data-base-path": ctx.config.basePath || "/",
          "data-page-path": ctx.navigation.current?.path?.directory || "",
          ...(height
            ? { style: `--ide-height: ${cssHeight(height)}` }
            : {}),
          ...(library ? { "data-library": library } : {}),
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: { class: "container left-side" },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { class: "preview-container" },
                children: [
                  idePanelHeader("preview-header", [
                    idePanelTitle("openscad-preview"),
                  ]),
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
                  class: "canvas-params-splitter",
                  role: "separator",
                  "aria-label": "Resize canvas and parameters",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "div",
                properties: { class: "parameters-panel" },
                children: [
                  idePanelHeader("parameters-header", [
                    idePanelTitle("openscad-parameters"),
                  ]),
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
                    properties: { class: "render" },
                    children: [
                      { type: "text", value: i18n.get("openscad-render") },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "editor",
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
              ideBottomButtons(
                [
                  ideIconButton(
                    "download-stl",
                    "openscad-download-stl",
                    "download",
                  ),
                ],
                { filesAsArchive: true },
              ),
            ],
          },
        ];
      }
    });
  };
};
