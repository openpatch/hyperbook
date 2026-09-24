// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { readFile } from "./helper";
import { i18n } from "./i18n";
import { icon } from "./icons";

/**
 * A bitflow assessment, as `::bitflow{src="/quiz.json"}`.
 *
 * The document is read at build time and inlined, rather than fetched by the
 * element from its own `src`. That is what `jmp` and `learningmap` do, and it
 * buys the same three things: a missing or malformed file is a build message
 * instead of a blank box, the file is registered as a dependency so the dev
 * server rebuilds when it changes, and a built book needs no network to open
 * an assessment.
 *
 * Only the learner-facing element is wired up. `@bitflow/web-component` also
 * ships an authoring canvas and report views; a book is the reading half, and
 * loading `flow.js` rather than the combined `index.js` is what keeps the
 * editor's chunk off the page.
 */
export default (ctx: HyperbookContext) => () => {
  const name = "bitflow";
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
            // ESM, not the IIFE the other directives ship. The bundle splits a
            // chunk per bit type and imports them on demand, so a flow of three
            // multiple-choice questions never downloads the maths bit — which
            // is 2.4MB of MathLive and its compute engine. Bundling that to one
            // IIFE would put all of it on every page carrying an assessment.
            {
              type: "module" as const,
              src: "flow.js",
              position: "head" as const,
            },
            "client.js",
          ],
          ["style.css"],
          [],
        );

        const attributes = node.attributes || {};
        // `height="auto"` grows with the step shown; `maxHeight` caps that
        // growth, and the flow scrolls its step inside the cap. The flow keeps
        // its progress bar and buttons in view either way. Both are handed to
        // style.css as custom properties rather than as `height`/`max-height`
        // directly: an inline `height: 820px` cannot be capped to the
        // viewport from a stylesheet without `!important`, since inline
        // always outranks it, but `height: var(--bitflow-height, auto)` in
        // the stylesheet is not inline, so `max-height` there still bounds it
        // on a phone where the fixed height would otherwise run under the
        // fold.
        const height = attributes.height || "600px";
        const maxHeight = attributes.maxHeight;
        const id = attributes.id || resolveDirectiveId(file, node);
        const src = attributes.src;
        const locale = attributes.locale || ctx.config.language || "en";
        const readonly =
          attributes.readonly !== undefined && attributes.readonly !== "false";

        if (!src) {
          file.message(`Missing "src" attribute`, node);
          return SKIP;
        }

        const srcFile = readFile(src, ctx);
        if (!srcFile) {
          file.message(`File not found: ${src}`, node);
          return SKIP;
        }

        let flow: unknown;
        try {
          flow = JSON.parse(srcFile);
        } catch (e) {
          file.message(`Could not parse ${src}: ${e}`, node);
          return SKIP;
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-bitflow",
          id: `bitflow-${id}`,
          style: [
            height !== "auto" ? `--bitflow-height: ${height}` : undefined,
            maxHeight ? `--bitflow-max-height: ${maxHeight}` : undefined,
          ]
            .filter(Boolean)
            .join("; "),
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "bitflow-flow",
            properties: {
              // The element declares `flow` as a JSON prop, so the attribute
              // form is equivalent to assigning the object — the same trade jmp
              // makes with `memory`.
              flow: JSON.stringify(flow),
              locale,
              ...(readonly ? { readonly: "true" } : {}),
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "buttons",
            },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  class: "reset",
                  title: i18n.get("bitflow-reset"),
                  "aria-label": i18n.get("bitflow-reset"),
                },
                children: [icon("reset")],
              },
            ],
          },
        ];
      }
    });
  };
};
