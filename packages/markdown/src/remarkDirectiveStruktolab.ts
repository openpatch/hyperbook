// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectDirective,
  isCode,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { ElementContent } from "hast";
import { resolveDirectiveId } from "./directiveId";
import { recordStoredElement } from "./storedElements";
import { expectFile } from "./helper";

/** The languages a structogram can be written in, by the code fence's language. */
const CODE_LANGUAGES: Record<string, "java" | "python" | "javascript"> = {
  java: "java",
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
};

/** What `code` may say: these, or "none" to hide the code under the editor. */
const CODE_MODES = ["none", "pseudocode", "java", "python", "javascript"];

export default (ctx: HyperbookContext) => () => {
  const name = "struktolab";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        const {
          id = resolveDirectiveId(file, node),
          lang = ctx.config.language,
          colorMode = "color",
          fontSize = 14,
          scale = 1,
          src,
          mode = "preview", // "preview" or "edit"
          // The language the structogram is written in. A fence's language
          // (```java) says it too; this wins when both are there.
          code,
          // The diagram alone, without the code under it (edit mode); the
          // language stays. A flag ({hideCode}) or "true"/"false".
          hideCode,
        } = node.attributes || {};
        recordStoredElement(file, name, id, node);
        const hidden = hideCode != null && hideCode !== "false";

        expectDirective(node, file, "struktolab", ["leaf", "container"]);

        registerDirective(
          file,
          name,
          [
            "client.js",
            "struktolab-renderer.umd.js",
            "struktolab-editor.umd.js",
          ],
          ["style.css"],
          [],
        );

        let webcomponent = "struktolab-renderer";
        if (mode === "edit") {
          webcomponent = "struktolab-editor";
        }

        const codeMode =
          typeof code === "string" && CODE_MODES.includes(code)
            ? code
            : undefined;

        let fenceMode: string | undefined;
        const codes: ElementContent[] = node.children
          ?.filter(isCode)
          .map((n) => {
            // ```java, ```python, ```js — or the directive's `code` for a bare fence.
            const language =
              CODE_LANGUAGES[(n.lang || "").toLowerCase()] ??
              (codeMode && codeMode in CODE_LANGUAGES
                ? CODE_LANGUAGES[codeMode]
                : undefined);
            fenceMode ??= language;
            return {
              type: "element",
              tagName: "script",
              properties: language
                ? { type: "text/plain", dataCode: language }
                : { type: "text/pseudocode" },
              children: [
                {
                  type: "text",
                  value: n.value,
                },
              ],
            };
          });

        expectFile(file, ctx, node, "struktolab", "src", src);
        data.hName = "div";
        data.hProperties = {
          class: "directive-struktolab",
        };

        data.hChildren = [
          {
            type: "element",
            tagName: webcomponent,
            properties: {
              lang: lang ?? undefined,
              "color-mode": colorMode,
              "font-size": fontSize,
              scale: scale == null ? undefined : String(scale),
              "code-mode": codeMode ?? fenceMode,
              "hide-code": hidden ? "" : undefined,
              // Reset beside Undo/Redo: back to the page's structogram
              // (client.js drops the saved copy on its "reset" event).
              resettable: mode === "edit" ? "" : undefined,
              "data-id": id,
              src: src
                ? ctx.makeUrl(
                    src as string,
                    "public",
                    ctx.navigation.current || undefined,
                  )
                : undefined,
            },
            children: [...codes],
          },
        ];
      }
    });
  };
};
