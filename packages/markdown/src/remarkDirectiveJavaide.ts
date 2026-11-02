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
import {
  collectWorkspace,
  cssHeight,
  encodeWorkspace,
  fileActionAttributes,
  htmlEntities,
  ideBottomButtons,
  idePanelHeader,
  idePanelTitle,
  ideSplitter,
  requestIdeAssets,
} from "./ideWorkspace";
import { resolveDirectiveId } from "./directiveId";
import { ElementContent } from "hast";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  const name = "javaide";
  const cdn = elementCdn(ctx.config, name, hostedRuntime(ctx, name));
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const { id = resolveDirectiveId(file, node), height } =
          node.attributes || {};

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);
        requestIdeAssets(file);

        if (!cdn) {
          file.message(
            "javaide loads the CheerpJ runtime from its CDN by default; the CLI does not download it for local builds. Set elements.javaide.cdn to the base URL of a self-hosted CheerpJ 5.0 runtime (the directory containing loader.js) instead of false.",
            node as never,
          );
        }

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["java"],
          defaultMain: "Main.java",
        });
        const mainFile = workspace.files.find((f) => f.path === workspace.main);
        const hasTests = workspace.files.some((f) => f.role === "test");

        data.hName = "div";
        data.hProperties = {
          class: "directive-javaide ide",
          ...(cdn
            ? { "data-runtime-url": elementAssetUrl(ctx, name, "cheerpj/") }
            : {}),
          id: id ?? undefined,
          "data-workspace": encodeWorkspace(workspace),
          ...fileActionAttributes(node, file, { name, accept: ".java" }),
          ...(height ? { style: `--ide-height: ${cssHeight(height)}` } : {}),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
            },
            children: [
              idePanelHeader("", [idePanelTitle("javaide-output")]),
              {
                type: "element",
                tagName: "pre",
                properties: {
                  class: "output",
                },
                children: [],
              },
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
                  class: "buttons",
                },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "run",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("javaide-run"),
                      },
                    ],
                  },
                  ...(hasTests
                    ? [
                        {
                          type: "element",
                          tagName: "button",
                          properties: {
                            class: "test",
                          },
                          children: [
                            {
                              type: "text",
                              value: i18n.get("javaide-test"),
                            },
                          ],
                        } as ElementContent,
                      ]
                    : []),
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "stop",
                      disabled: true,
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("javaide-stop"),
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
                  "data-lang": "java",
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
