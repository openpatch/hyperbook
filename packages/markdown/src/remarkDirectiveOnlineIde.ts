// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Code, Root, Text } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isCode,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";
import { resolveDirectiveId } from "./directiveId";

export default (ctx: HyperbookContext) => () => {
  const name = "onlineide";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const {
          height = ctx.config.elements?.onlineide?.height || "calc(100dvh - 80px)",
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
          ? ctx.makeUrl(".", "book", page, { versioned: false }).replace(/\/?$/, "/")
          : undefined;
        const assetBaseConfig = assetBase
          ? `, 'assetBaseUrl': '${assetBase.replace(/['"\\]/g, "")}'`
          : "";

        // Parse @file directives from text content
        const binaryFiles: { dest: string; url: string }[] = [];
        for (const child of node.children) {
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
        registerDirective(
          file,
          name,
          [
            {
              type: "module",
              crossorigin: true,
              src: "include/online-ide-embedded.js",
              position: "head",
              versioned: false
            },
          ],
          ["style.css", "include/online-ide-embedded.css"],
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

        // Add binary files as script elements with data-type="image"
        const fileElements: ElementContent[] = binaryFiles.map((file) => ({
          type: "element",
          tagName: "script",
          properties: {
            type: "text/plain",
            title: file.dest,
            "data-type": "image",
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
