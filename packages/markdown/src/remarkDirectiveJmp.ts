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
 * The display options of the playground, as kebab-case directive attributes.
 *
 * A diagram carries its own options, so these are overrides — a book can hide
 * the sidebar on a figure the reader is only meant to look at without editing
 * the file it came from.
 */
const OPTIONS: Record<string, string> = {
  "hide-sidebar": "hideSidebar",
  "hide-call-method": "hideCallMethod",
  "hide-declare-global-variable": "hideDeclareGlobalVariable",
  "hide-new-array": "hideNewArray",
  "disable-garbage-collector": "disableGarbageCollector",
  "create-new-on-edge-drop": "createNewOnEdgeDrop",
  "inline-strings": "inlineStrings",
  "hide-steps": "hideSteps",
  "hide-step-changes": "hideStepChanges",
  "gc-prediction": "gcPrediction",
};

export default (ctx: HyperbookContext) => () => {
  const name = "jmp";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(
          file,
          name,
          ["client.js", "jmp.umd.js"],
          ["style.css", "web-component-jmp.css"],
          [],
        );

        const attributes = node.attributes || {};
        const height = attributes.height || "600px";
        const id = attributes.id || resolveDirectiveId(file, node);
        const src = attributes.src;
        const step = attributes.step;
        const language = attributes.language || ctx.config.language || "en";

        if (!src) {
          file.message(`Missing "src" attribute`, node);
          return SKIP;
        }

        const srcFile = readFile(src, ctx);
        if (!srcFile) {
          file.message(`File not found: ${src}`, node);
          return SKIP;
        }

        let memory: unknown;
        try {
          memory = JSON.parse(srcFile);
        } catch (e) {
          file.message(`Could not parse ${src}: ${e}`, node);
          return SKIP;
        }

        // An attribute written without a value is on; `=false` turns an option
        // off that the diagram file itself switched on.
        const options: Record<string, boolean> = {};
        for (const [attribute, option] of Object.entries(OPTIONS)) {
          const value = attributes[attribute];
          if (value !== undefined) {
            options[option] = value !== "false";
          }
        }

        data.hName = "div";
        data.hProperties = {
          class: "directive-jmp",
          id: `jmp-${id}`,
          style: `height: ${height}`,
        };

        data.hChildren = [
          {
            type: "element",
            tagName: "java-memory-playground",
            properties: {
              memory: JSON.stringify(memory),
              language,
              ...(Object.keys(options).length > 0
                ? { options: JSON.stringify(options) }
                : {}),
              ...(step ? { step } : {}),
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
                  title: i18n.get("jmp-reset"),
                  "aria-label": i18n.get("jmp-reset"),
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
