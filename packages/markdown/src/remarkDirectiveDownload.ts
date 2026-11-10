// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { Element } from "hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { icon } from "./icons";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";
import { resolveFile } from "./helper";
import { registerTypstDownload } from "./typstJobs";

export default (ctx: HyperbookContext) => () => {
  const name = "download";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectDirective(node, file, name, ["text", "leaf"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const { src = "" } = node.attributes || {};
        // Typst sources are not part of the site unless a download names
        // them: then the source itself is offered, as it is.
        if (/\.typ$/i.test(String(src).split(/[?#]/)[0]!)) {
          const source = resolveFile(String(src), ctx);
          if (source) registerTypstDownload(file, source.href);
        }
        data.hName = "a";
        data.hProperties = {
          class: "directive-download",
          target: "_blank",
          rel: ["noopener", "noreferrer"],
          href: ctx.makeUrl(
            src as string,
            "public",
            ctx.navigation.current || undefined,
          ),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "icon",
            },
            children: [icon("download")],
          },
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "label",
            },
            children: (toHast(node) as Element)?.children,
          },
        ];
      }
    });
  };
};
