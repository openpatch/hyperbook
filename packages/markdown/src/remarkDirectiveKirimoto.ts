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

export default (ctx: HyperbookContext) => () => {
  const name = "kirimoto";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const {
          height = ctx.config.elements?.kirimoto?.height || "calc(100vh - 60px)",
          mode,
          model,
          workspace,
          settings = ctx.config.elements?.kirimoto?.settings,
        } = node.attributes || {};

        expectLeafDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const properties: Record<string, string | undefined> = {
          class: "directive-kirimoto",
          style: `--kirimoto-height: ${height}`,
        };

        if (mode) properties["data-mode"] = mode;
        if (model) properties["data-model"] = model;
        if (workspace) properties["data-workspace"] = workspace;
        if (settings) properties["data-settings"] = settings;

        data.hName = "div";
        data.hProperties = properties;
        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src: "https://grid.space/kiri/",
              allowfullscreen: true,
              title: "Kiri:Moto 3D Slicer",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: { class: "menu" },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  onclick: "hyperbook.kirimoto.openFullscreen(this)",
                },
                children: [{ type: "text", value: "Fullscreen" }],
              },
            ],
          },
        ];
      }
    });
  };
};
