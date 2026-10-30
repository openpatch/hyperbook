// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn, hostedRuntime } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { readFile } from "./helper";
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
  const cdn = elementCdn(ctx.config, name, hostedRuntime(ctx, name));
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

        const scriptElement = (
          title: string | undefined,
          dataType: string,
          value: string,
        ): ElementContent => ({
          type: "element",
          tagName: "script",
          properties: {
            type: "text/plain",
            title,
            "data-type": dataType,
          },
          children: [
            {
              type: "text",
              value,
            },
          ],
        });

        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) =>
            scriptElement(
              n.meta ?? undefined,
              n.lang === "md" || n.lang === "markdown" ? "hint" : "sql",
              n.value,
            ),
          );

        // ::file{path="…" src="…"} adds a file from the book. The embedded
        // SQL IDE reads only what is on the page, so the source is read here
        // and a missing one is reported to the author. A Markdown source
        // becomes a hint, everything else an SQL file.
        const fileScripts: ElementContent[] = [];
        for (const child of node.children || []) {
          if (
            child.type !== "leafDirective" ||
            (child as { name?: string }).name !== "file"
          ) {
            continue;
          }
          const fileAttributes =
            (child as { attributes?: Record<string, string> }).attributes || {};
          const src = fileAttributes.src;
          if (!src) {
            file.message(
              `::file in the ${name} directive needs a src="…".`,
              child as never,
            );
            continue;
          }
          const filePath = fileAttributes.path || path.posix.basename(src);
          const content = readFile(src, ctx);
          if (content === null) {
            file.message(
              `::file in the ${name} directive: "${src}" was not found.`,
              child as never,
            );
            continue;
          }
          fileScripts.push(
            scriptElement(
              filePath,
              /\.(md|markdown)$/i.test(filePath) ? "hint" : "sql",
              content,
            ),
          );
        }

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
            children: [...(codes || []), ...fileScripts],
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
