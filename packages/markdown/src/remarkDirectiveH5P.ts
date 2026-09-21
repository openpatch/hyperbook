// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";

export default (ctx: HyperbookContext) => () => {
  const name = "h5p";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const src = attributes.src;
        const id = attributes.id || resolveDirectiveId(file, node);
        const allowExport =
          attributes.export !== undefined && attributes.export !== "false";
        const resolvedSrc = src
          ? ctx.makeUrl(src, "public", ctx.navigation.current || undefined)
          : undefined;
        const archiveName = src?.split("/").filter(Boolean).pop();
        const configuredDownloadUrl = attributes["download-url"];
        const resolvedDownloadUrl = configuredDownloadUrl
          ? ctx.makeUrl(
              configuredDownloadUrl,
              "public",
              ctx.navigation.current || undefined,
            )
          : resolvedSrc && archiveName
            ? `${resolvedSrc}/${archiveName}`
            : undefined;

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["main.bundle.js", "client.js"],
          ["style.css"],
          [],
        );
        data.hName = "div";
        data.hProperties = {
          class: "directive-h5p",
          "data-src": resolvedSrc,
          "data-id": id,
          "data-export": allowExport ? "true" : undefined,
          "data-download-url": allowExport ? resolvedDownloadUrl : undefined,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "h5p-frame",
            },
            children: [],
          },
        ];
      }
    });
  };
};
