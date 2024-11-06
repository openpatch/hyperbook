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
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== "tabs") return;

        const data = node.data || (node.data = {});

        if (node.name === "tabs") {
          expectContainerDirective(node, file, "tabs");

          let { id: tabsId } = node.attributes || {};

          if (!tabsId) {
            tabsId = hash(node);
          }

          registerDirective(file, "tabs", ["client.js"], ["style.css"]);

          data.hName = "div";
          data.hProperties = {
            class: "directive-tabs",
          };

          const tabContentElements: Element[] = [];
          const tabTitleElements: Element[] = [];

          let first = true;
          node.children.filter(isDirective).forEach((node) => {
            expectContainerDirective(node, file, "tab");
            let { title, id: tabId = hash(node) } = node.attributes || {};

            tabTitleElements.push({
              type: "element",
              tagName: "button",
              properties: {
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
                class: "tab" + (first ? " active" : ""),
              },
              children: [
                {
                  type: "text",
                  value: title || "",
                },
              ],
            });

            tabContentElements.push({
              type: "element",
              tagName: "div",
              properties: {
                class: "tabpanel" + (first ? " active" : ""),
                "data-tab-id": tabId,
                "data-tabs-id": tabsId,
              },
              children: (toHast(node) as Element)?.children,
            });

            first = false;
          });
          data.hChildren = [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "tabs",
                "data-tabs-id": tabsId,
              },
              children: tabTitleElements,
            },
            ...tabContentElements,
          ];
        }
      }
    });
  };
};
