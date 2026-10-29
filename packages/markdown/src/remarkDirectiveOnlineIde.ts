// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Code, Root, Text } from "mdast";
import path from "path";
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

// The embedded Online-IDE distinguishes scripts by data-type: "image" and
// "asset" are fetched as a blob and become a data URL (shader sources are
// decoded back to text by the IDE), "hint" is a markdown hint, and anything
// else is a plain text file. Text formats like .json must not become data
// URLs, because nothing on the IDE side decodes them.
const IMAGE_FILES = /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i;
const ASSET_FILES =
  /\.(frag|vert|glsl|wav|wave|mp3|ogg|opus|flac|m4a|aac|webm|mp4|ttf|otf|woff2?)$/i;

function workspaceFileDataType(dest: string): string {
  if (IMAGE_FILES.test(dest)) return "image";
  if (ASSET_FILES.test(dest)) return "asset";
  return "java";
}

export default (ctx: HyperbookContext) => () => {
  const name = "onlineide";
  const cdn = elementCdn(ctx.config, name);
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const {
          height = ctx.config.elements?.onlineide?.height ||
            "calc(100dvh - 80px)",
          fileList = true,
          console: con = true,
          pCode = false,
          libraries = "",
          bottomPanel = true,
          errorList = true,
          speed = 1000,
          outputWidth = ctx.config.elements?.onlineide?.outputWidth,
          id = resolveDirectiveId(file, node),
        } = attributes;

        // Width of the output panel next to the editor, as CSS ("60%",
        // "520px"). Left out, the IDE keeps its own 300px. Quotes would end
        // the value inside data-java-online, so they are dropped.
        const outputWidthConfig = outputWidth
          ? `, 'outputWidth': '${String(outputWidth).replace(/['"\\]/g, "")}'`
          : "";

        // Relative paths in a program (addCostume("held", "assets/held.png"))
        // start from the folder of this page's Markdown file, as they start
        // from the project folder on the desktop. An assets folder next to the
        // page then serves every page in that folder.
        const page = ctx.navigation.current;
        const assetBase = page
          ? ctx
              .makeUrl(".", "book", page, { versioned: false })
              .replace(/\/?$/, "/")
          : undefined;
        const assetBaseConfig = assetBase
          ? `, 'assetBaseUrl': '${assetBase.replace(/['"\\]/g, "")}'`
          : "";

        // Collect the files the program works with: ::file directives, and
        // the @file lines the directive read before ::file existed.
        const binaryFiles: { dest: string; url: string }[] = [];
        for (const child of node.children) {
          if (
            child.type === "leafDirective" &&
            (child as { name?: string }).name === "file"
          ) {
            const fileAttributes =
              (child as { attributes?: Record<string, string> }).attributes ||
              {};
            const src = fileAttributes.src;
            if (!src) {
              file.message(
                `::file in the ${name} directive needs a src="…".`,
                child as never,
              );
              continue;
            }
            binaryFiles.push({
              dest: fileAttributes.path || path.posix.basename(src),
              url: ctx.makeUrl(
                src,
                "public",
                ctx.navigation.current || undefined,
              ),
            });
            continue;
          }

          let text = "";
          if (child.type === "text") {
            text = (child as Text).value;
          } else if (child.type === "paragraph") {
            const reconstructText = (paragraphNode: any): string => {
              if (paragraphNode.type === "text") return paragraphNode.value;
              if (paragraphNode.type === "link") return paragraphNode.url;
              if (paragraphNode.children) {
                return paragraphNode.children.map(reconstructText).join("");
              }
              return "";
            };
            text = child.children.map(reconstructText).join("");
          }

          if (!text) continue;
          const fileMatches = text.matchAll(
            /@file\s+dest="([^"]+)"\s+src="([^"]+)"/g,
          );
          for (const match of fileMatches) {
            const dest = match[1];
            const src = match[2];
            const url = ctx.makeUrl(
              src,
              "public",
              ctx.navigation.current || undefined,
            );
            binaryFiles.push({ dest, url });
          }
        }

        expectContainerDirective(node, file, name);
        if (cdn) requestJS(file, ["cdn-workers.js"]);
        registerDirective(
          file,
          name,
          [
            {
              type: "module",
              crossorigin: true,
              src: cdn
                ? elementAssetUrl(ctx, name, "include/online-ide-embedded.js")
                : "include/online-ide-embedded.js",
              position: "head",
              versioned: false,
            },
          ],
          [
            "style.css",
            cdn
              ? elementAssetUrl(ctx, name, "include/online-ide-embedded.css")
              : "include/online-ide-embedded.css",
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
                n.lang === "md" || n.lang === "markdown" ? "hint" : "java",
            },
            children: [
              {
                type: "text",
                value: n.value,
              },
            ],
          }));

        // Add the ::file and @file entries as workspace files with a
        // data-type matching the kind of file, as the embedded IDE expects it.
        const fileElements: ElementContent[] = binaryFiles.map((file) => ({
          type: "element",
          tagName: "script",
          properties: {
            type: "text/plain",
            title: file.dest,
            "data-type": workspaceFileDataType(file.dest),
            src: file.url,
          },
          children: [],
        }));

        data.hName = "div";
        data.hProperties = {
          class: "directive-onlineide",
          style: `--onlineide-height: ${height}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "java-online",
              style: `padding: 0; margin: 0;`,
              "data-java-online": `{'id': '${id}', 'speed': ${speed}, 'withBottomPanel': ${bottomPanel},'withPCode': ${pCode},'withConsole': ${con},'withFileList': ${fileList},'withErrorList': ${errorList}, 'libraries': [${libraries?.split(",").map((lib) => `'${lib.trim()}'`)}], 'binaryFiles': ${JSON.stringify(binaryFiles)}${outputWidthConfig}${assetBaseConfig}}`,
            },
            children: [...codes, ...fileElements],
          },
        ];
      }
    });
  };
};
