// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { i18n } from "./i18n";
import { Element } from "hast";
import {
  collectWorkspace,
  compareAttributes,
  fileActionAttributes,
  cssHeight,
  encodeWorkspace,
  htmlEntities,
  ideBottomButtons,
  ideSplitter,
  requestIdeAssets,
} from "./ideWorkspace";

/** The size pages are compared at: compare="WxH", or 400×300. */
const pageSize = (
  node: ContainerDirective | LeafDirective | TextDirective,
  file: VFile,
): [number, number] => {
  const value = String(node.attributes?.compare ?? "").trim();
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (match && Number(match[1]) > 0 && Number(match[2]) > 0) {
    return [Number(match[1]), Number(match[2])];
  }
  if (value) {
    file.message(
      `compare="${value}" in the webide directive should be a size like compare="400x300", or empty.`,
      node as never,
    );
  }
  return [400, 300];
};

/**
 * A small website: `index.html` and the files it links. The page is shown in
 * an iframe and updated as the reader types.
 */
export default (ctx: HyperbookContext) => () => {
  const name = "webide";

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const {
          height,
          id = resolveDirectiveId(file, node),
        } = node.attributes || {};
        const data = node.data || (node.data = {});
        const resolvedHeight = cssHeight(height);

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestIdeAssets(file);

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["html"],
          defaultMain: "index.html",
        });
        const mainFile = workspace.files.find((f) => f.path === workspace.main);
        const compare = compareAttributes(node, file, workspace, name);
        // A page has no size of its own: both are rendered at the size
        // compare="WxH" gives (400×300 without one), and the frame has it,
        // so the reader sees what is compared.
        const compareSize = compare["data-compare"]
          ? pageSize(node, file)
          : null;

        const preview: Element = {
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
            "aria-label": i18n.get("webide-code-preview"),
            title: i18n.get("webide-code-preview"),
            ...(compareSize
              ? {
                  style: `width: ${compareSize[0]}px; height: ${compareSize[1]}px;`,
                }
              : {}),
          },
          children: [],
        };

        data.hName = "div";
        data.hProperties = {
          class: "directive-webide ide",
          "data-id": id,
          "data-workspace": encodeWorkspace(workspace),
          ...fileActionAttributes(node, file, {
            name,
            accept: ".html,.css,.js",
          }),
          ...compare,
          ...(height !== undefined
            ? { style: `--ide-height: ${resolvedHeight}` }
            : {}),
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
                  class: "ide-panel-header container-title",
                },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    properties: { class: "ide-panel-title container-title-text" },
                    children: [],
                  },
                ],
              },
              // With compare, the frame has the compared size, in an area
              // that scrolls when the panel is smaller.
              compareSize
                ? {
                    type: "element",
                    tagName: "div",
                    properties: { class: "webide-frame" },
                    children: [preview],
                  }
                : preview,
            ],
          },
          ideSplitter(),
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
                  class: "editor",
                },
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
        ];
      }
    });
  };
};
