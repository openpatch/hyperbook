/// <reference types="mdast-util-directive" />
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toString } from "mdast-util-to-string";

interface BlockflowStep {
  title?: string;
  text?: string;
  image?: string;
  video?: string;
}

interface BlockflowConfig {
  title?: string;
  sb3?: string;
  ui?: {
    allowExtensions?: boolean;
    showCostumesTab?: boolean;
    showSoundsTab?: boolean;
  };
  toolbox?: {
    categories?: string[];
    blocks?: Record<string, string[]>;
  };
  steps?: BlockflowStep[];
}

export default (ctx: HyperbookContext) => () => {
  const name = "blockflow-editor";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], ["step"]);

        const {
          title,
          src,
          project,
          width = "100%",
          height = "700px",
          aspectRatio,
          allowExtensions,
          showCostumesTab,
          showSoundsTab,
          categories,
          ...rest
        } = node.attributes || {};

        let projectParam: string;

        if (project) {
          // Use the provided project JSON URL directly
          projectParam = encodeURIComponent(project as string);
        } else {
          const steps: BlockflowStep[] = [];

          for (const child of (node as any).children || []) {
            if (!isDirective(child) || child.name !== "step") continue;

            const stepAttrs = child.attributes || {};
            const text = toString(child).trim() || undefined;

            steps.push({
              title: stepAttrs.title || undefined,
              text,
              image: stepAttrs.image || undefined,
              video: stepAttrs.video || undefined,
            });
          }

          const config: BlockflowConfig = {};
          if (title) config.title = title;
          if (src) config.sb3 = src;

          const ui: BlockflowConfig["ui"] = {};
          if (allowExtensions !== undefined) {
            ui.allowExtensions = allowExtensions !== "false";
          }
          if (showCostumesTab !== undefined) {
            ui.showCostumesTab = showCostumesTab !== "false";
          }
          if (showSoundsTab !== undefined) {
            ui.showSoundsTab = showSoundsTab !== "false";
          }
          if (Object.keys(ui).length > 0) {
            config.ui = ui;
          }

          if (categories || Object.keys(rest).some((k) => k.startsWith("blocks-"))) {
            config.toolbox = {};
            if (categories) {
              config.toolbox.categories = (categories as string)
                .split(",")
                .map((c) => c.trim());
            }
            const blocks: Record<string, string[]> = {};
            for (const [key, value] of Object.entries(rest)) {
              if (key.startsWith("blocks-") && value) {
                const category = key.slice("blocks-".length);
                blocks[category] = (value as string)
                  .split(",")
                  .map((b) => b.trim());
              }
            }
            if (Object.keys(blocks).length > 0) {
              config.toolbox.blocks = blocks;
            }
          }

          if (steps.length > 0) config.steps = steps;

          const configJson = JSON.stringify(config);
          projectParam = Buffer.from(configJson).toString("base64");
        }

        const iframeSrc = `https://blockflow.openpatch.org?project=${projectParam}`;

        data.hName = "div";
        data.hProperties = {
          class: "directive-blockflow-editor",
          style: `aspect-ratio: ${aspectRatio}; height: ${height}; width: ${width}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src: iframeSrc,
              allowfullscreen: true,
            },
            children: [],
          },
        ];

        node.children = [];
      }
    });
  };
};
