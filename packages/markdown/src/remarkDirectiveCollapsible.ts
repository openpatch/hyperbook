// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { Element, ElementContent } from "hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { remark } from "./process";

export default (ctx: HyperbookContext) => () => {
  const name = "collapsible";

  const transformCollapsible = (element: ElementContent): ElementContent[] => {
    if (element.type === "element" && element.tagName === "collapsible") {
      return [
        {
          type: "element",
          tagName: "button",
          properties: {
            class: "collapsible",
          },
          children: [
            {
              type: "text",
              value: element.properties.title as string,
            },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "collapsible-content",
          },
          children: element.children.flatMap(transformCollapsible),
        },
      ];
    }

    return [element];
  };

  const collapsibleNodes: (
    | TextDirective
    | ContainerDirective
    | LeafDirective
  )[] = [];

  return async (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;
        collapsibleNodes.push(node);
        return;
      }
    });

    for (const node of collapsibleNodes) {
      const data = node.data || (node.data = {});
      const { title = "", id } = node.data.hProperties || {};

      expectContainerDirective(node, file, name);
      registerDirective(file, name, [], ["style.css"]);

      node.attributes = {};
      data.hName = "div";
      data.hProperties = {
        class: "directive-collapsible",
        "data-id": id,
      };

      const collapsibleContent = [];

      for (const child of node.children) {
        collapsibleContent.push(await remark(ctx).run(child))
      }

      console.log(collapsibleContent)

      data.hChildren = [
        {
          type: "element",
          tagName: "button",
          properties: {
            class: "collapsible",
          },
          children: [
            {
              type: "text",
              value: title as string,
            },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "collapsible-content",
          },
          children: collapsibleContent,
        },
      ];
    }
  };
};
