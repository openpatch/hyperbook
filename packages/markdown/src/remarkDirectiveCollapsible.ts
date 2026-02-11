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

export default (ctx: HyperbookContext) => function (this: Processor) {
  const name = "collapsible";
  const processor = this;

  return async (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      if (isDirective(node) && node.name === name) {
        const data = node.data || (node.data = {});
        // Get title from attributes
        const { title = "" } = node.attributes || {};
        const { id = hash(node) } = data.hProperties || {};

        expectContainerDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        // 1. Prepare the 'details' element properties
        node.attributes = {};
        data.hName = "details";
        data.hProperties = {
          class: "directive-collapsible",
          "data-id": id,
        };

        // 2. Parse the title string into MDAST nodes
        const parsedTitle = processor.parse(title as string);
        // Extract children from the first paragraph of the parsed title
        const titleNodes = (parsedTitle.children[0] as any)?.children || [
          { type: "text", value: title },
        ];

        const summaryNode: any = {
          type: "paragraph",
          data: {
            hName: "summary",
          },
          children: titleNodes,
        };

        // 3. Create a wrapper for the content
        const contentWrapper: any = {
          type: "parent",
          data: {
            hName: "div",
            hProperties: { class: "content" },
          },
          children: [...node.children],
        };

        // 4. Update the node's children
        node.children = [summaryNode, contentWrapper];
      }
    });
  };
};
