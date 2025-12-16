// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Element } from "hast";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";
import { remark } from "./process";
import hash from "./objectHash";
import remarkGemoji from "remark-gemoji";
import { Processor } from "unified";
import { LeafDirective, TextDirective } from "mdast-util-directive";
import { ContainerDirective } from "mdast-util-directive";

export default function (ctx: HyperbookContext) {
  return function (this: Processor) {
    const self = this;
    return async (tree: Root, file: VFile) => {
      const tabsNodes: (TextDirective | ContainerDirective | LeafDirective)[] =
        [];
      visit(tree, function (node) {
        if (isDirective(node)) {
          if (node.name == "tab") {
            registerDirective(
              file,
              "tabs",
              ["client.js"],
              ["style.css"],
              ["tab"],
            );
          }
          if (node.name !== "tabs") return;

          tabsNodes.push(node);
          return;
        }
      });

      for (const node of tabsNodes) {
        const data = node.data || (node.data = {});

        if (node.name === "tabs") {
          expectContainerDirective(node, file, "tabs");

          let { id: tabsId } = node.attributes || {};

          if (!tabsId) {
            tabsId = hash(node);
          }

          // Generate a unique instance ID for this specific tab group
          // This ensures radio button names are unique per instance
          const instanceId = hash(node);

          registerDirective(
            file,
            "tabs",
            ["client.js"],
            ["style.css"],
            ["tab"],
          );

          data.hName = "div";
          data.hProperties = {
            class: "directive-tabs",
          };

          const tabContentElements: Element[] = [];
          const tabTitleElements: Element[] = [];

          let first = true;

          for (const tabNode of node.children.filter(isDirective)) {
            expectContainerDirective(tabNode, file, "tab");
            let { title = "", id: tabId = hash(tabNode) } =
              tabNode.attributes || {};

            let tree = remark(ctx).parse(title as string);
            remarkGemoji()(tree);
            let hastTree = toHast(tree);
            if (
              hastTree.type === "root" &&
              hastTree.children[0]?.type === "element" &&
              hastTree.children[0]?.tagName === "p"
            ) {
              hastTree = hastTree.children[0];
              hastTree.tagName = "span";
            }

            // Add hidden radio input for CSS-only tab switching
            // Use instanceId for unique radio names, tabsId for syncing across instances
            tabTitleElements.push({
              type: "element",
              tagName: "input",
              properties: {
                type: "radio",
                name: `tabs-${instanceId}`,
                id: `tab-${instanceId}-${tabId}`,
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
                class: "tab-input",
                checked: first,
              },
              children: [],
            });

            // Add label that acts as the tab button
            tabTitleElements.push({
              type: "element",
              tagName: "label",
              properties: {
                for: `tab-${instanceId}-${tabId}`,
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
                class: "tab" + (first ? " active" : ""),
              },
              children: (hastTree as Element).children || [],
            });

            const tabContent = await remark(ctx).run(tabNode);
            tabContentElements.push({
              type: "element",
              tagName: "div",
              properties: {
                class: "tabpanel" + (first ? " active" : ""),
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
              },
              children: [tabContent],
            });

            first = false;
          }

          // Separate radio inputs from labels
          const radioInputs: Element[] = [];
          const labelElements: Element[] = [];
          
          for (let i = 0; i < tabTitleElements.length; i += 2) {
            radioInputs.push(tabTitleElements[i]); // inputs
            labelElements.push(tabTitleElements[i + 1]); // labels
          }

          data.hChildren = [
            ...radioInputs, // Radio inputs as direct children
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "tabs",
                "data-tabs-id": tabsId,
              },
              children: labelElements, // Only labels in tabs div
            },
            ...tabContentElements,
          ];
        }
      }
    };
  };
}
