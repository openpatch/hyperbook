// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isCode,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "sqlide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const {
          id = hash(node),
          db = ctx.config.elements?.sqlide?.db ||
            ctx.makeUrl(
              [
                "directive-sqlide",
                "include",
                "assets",
                "databases",
                "world1.sqLite",
              ],
              "assets",
              undefined,
              { versioned: false },
            ),
          height = ctx.config.elements?.sqlide?.height || "600px",
        } = attributes;

        expectContainerDirective(node, file, name);
        registerDirective(
          file,
          name,
          [
            "client.js",
            {
              type: "module",
              crossorigin: true,
              src: "include/sql-ide-embedded.js",
              position: "head",
              versioned: false,
            },
          ],
          ["style.css", "include/sql-ide-embedded.css"],
          [],
        );

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => ({
            type: "element",
            tagName: "script",
            properties: {
              type: "text/plain",
              title: n.meta,
              "data-type":
                n.lang === "md" || n.lang === "markdown" ? "hint" : "sql",
            },
            children: [
              {
                type: "text",
                value: n.value,
              },
            ],
          }));

        data.hName = "div";
        data.hProperties = {
          class: "directive-sqlide",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "sql-online",
              style: `height: ${height}; padding: 0; margin: 0;`,
              "data-sql-online": `{'id': '${id}', "databaseURL": "${db}"}`,
            },
            children: [...codes],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "menu",
            },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  onclick: "hyperbook.sqlide.openFullscreen(this)",
                },
                children: [
                  {
                    type: "text",
                    value: "Fullscreen",
                  },
                ],
              },
            ],
          },
        ];
      }
    });
  };
};
