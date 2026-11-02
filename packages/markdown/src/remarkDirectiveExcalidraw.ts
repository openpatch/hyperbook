// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn, hostedRuntime } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  const name = "excalidraw";
  const cdn = elementCdn(ctx.config, name, hostedRuntime(ctx, name));
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          [
            "client.js",
            cdn
              ? elementAssetUrl(ctx, name, "hyperbook-excalidraw.umd.js")
              : "hyperbook-excalidraw.umd.js",
          ],
          [
            "style.css",
            cdn
              ? elementAssetUrl(ctx, name, "excalidraw.css")
              : "excalidraw.css",
          ],
          [],
        );

        const attributes = node.attributes || {};
        const id = attributes.id || resolveDirectiveId(file, node);
        const {
          aspectRatio = "16/9",
          autoZoom,
          edit,
          src = "",
          onlinkopen,
        } = attributes;

        data.hName = "div";
        data.hProperties = {
          class: "directive-excalidraw",
          ...(cdn ? { "data-asset-base": elementAssetUrl(ctx, name, "") } : {}),
          style: `aspect-ratio: ${aspectRatio}`,
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "hyperbook-excalidraw",
            properties: {
              id,
              lang: ctx.config.language || "en",
              "auto-zoom": autoZoom,
              edit,
              src: ctx.makeUrl(
                src as string,
                "public",
                ctx.navigation.current || undefined,
              ),
              onlinkopen,
              "reset-label": i18n.get("excalidraw-reset"),
              "reset-prompt": i18n.get("excalidraw-reset-prompt"),
            },
            children: [],
          },
        ];
      }
    });
  };
};
