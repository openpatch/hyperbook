// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isCode,
  isDirective,
  registerDirective,
  requestJS,
} from "./remarkHelper";
import { ElementContent } from "hast";
import { resolveDirectiveId } from "./directiveId";

export default (ctx: HyperbookContext) => () => {
  const name = "sqlide";
  const cdn = elementCdn(ctx.config, name);
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        let {
          id = resolveDirectiveId(file, node),
          db,
          height = ctx.config.elements?.sqlide?.height || "calc(100dvh - 80px)",
        } = attributes;

        if (!db) {
          db = ctx.config.elements?.sqlide?.db
            ? ctx.makeUrl(ctx.config.elements?.sqlide?.db, "public")
            : elementAssetUrl(
                ctx,
                name,
                "include/assets/databases/world1.sqLite",
              );
        } else {
          db = ctx.makeUrl(db, "public", ctx.navigation.current || undefined);
        }

        expectContainerDirective(node, file, name);
        if (cdn) requestJS(file, ["cdn-workers.js"]);
        registerDirective(
          file,
          name,
          [
            "client.js",
            {
              type: "module",
              crossorigin: true,
              src: cdn
                ? elementAssetUrl(ctx, name, "include/sql-ide-embedded.js")
                : "include/sql-ide-embedded.js",
              position: "head",
              versioned: false,
            },
          ],
          [
            "style.css",
            cdn
              ? elementAssetUrl(ctx, name, "include/sql-ide-embedded.css")
              : "include/sql-ide-embedded.css",
          ],
          [],
        );

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => ({
            type: "element",
            tagName: "script",
            properties: {
              type: "text/plain",
              title: n.meta ?? undefined,
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
          style: `--sqlide-height: ${height}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "sql-online",
              style: `padding: 0; margin: 0;`,
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
