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
import hash from "./objectHash";
import { Processor } from "unified";

export default function (ctx: HyperbookContext) {
  return function (this: Processor) {
    // 'this' refers to the Processor, allowing us to use this.parse
    const processor = this;

    return async (tree: Root, file: VFile) => {
      const tabsNodes: any[] = [];
      visit(tree, (node) => {
        if (isDirective(node) && node.name === "tabs") {
          tabsNodes.push(node);
        }
      });

      for (const node of tabsNodes) {
        const data = node.data || (node.data = {});
        expectContainerDirective(node, file, "tabs");

        let { id: tabsId } = node.attributes || {};
        if (!tabsId) tabsId = hash(node);
        const instanceId = hash(node);

        registerDirective(file, "tabs", ["client.js"], ["style.css"], ["tab"]);

        data.hName = "div";
        data.hProperties = { class: "directive-tabs" };

        const radioInputs: any[] = [];
        const labels: any[] = [];
        const contents: any[] = [];

        let first = true;

        for (const child of node.children) {
          if (!isDirective(child) || child.name !== "tab") continue;

          let { title = "", id: tabId = hash(child) } = child.attributes || {};

          // --- TITLE PARSING LOGIC ---
          // Parse the title string into an MDAST tree
          const parsedTitle = processor.parse(title as string);
          // Extract children from the first paragraph to keep it "inline"
          const titleNodes = (parsedTitle.children[0] as any)?.children || [
            { type: "text", value: title },
          ];

          radioInputs.push({
            type: "paragraph",
            data: {
              hName: "input",
              hProperties: {
                type: "radio",
                name: `tabs-${instanceId}`,
                id: `tab-${instanceId}-${tabId}`,
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
                class: "tab-input",
                checked: first,
              },
            },
            children: [],
          });

          labels.push({
            type: "paragraph",
            data: {
              hName: "label",
              hProperties: {
                for: `tab-${instanceId}-${tabId}`,
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
                class: "tab" + (first ? " active" : ""),
              },
            },
            // We now use the parsed nodes instead of a raw text node
            children: titleNodes,
          });

          contents.push({
            type: "parent",
            data: {
              hName: "div",
              hProperties: {
                class: "tabpanel" + (first ? " active" : ""),
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
              },
            },
            children: child.children,
          });

          first = false;
        }

        node.children = [
          ...radioInputs,
          {
            type: "parent",
            data: {
              hName: "div",
              hProperties: {
                class: "tabs",
                "data-tabs-id": tabsId,
              },
            },
            children: labels,
          },
          ...contents,
        ];
      }
    };
  };
}
