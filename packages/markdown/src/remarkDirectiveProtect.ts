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
  const name = "protect";
  const processor = this;

  return async (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      if (isDirective(node) && node.name === name) {
        const data = node.data || (node.data = {});
        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const {
          password = "",
          description = "",
          id = hash(node),
        } = node.attributes || {};

        // 1. Setup the main container
        data.hName = "div";
        data.hProperties = {
          class: "directive-protect",
          "data-id": id,
          "data-toast": Buffer.from(password as string).toString("base64"),
        };

        // 2. Parse the description and strip the paragraph wrapper
        const parsedDescription = processor.parse(description as string);
        const descriptionNodes = (parsedDescription.children[0]?.type === 'paragraph')
          ? (parsedDescription.children[0] as any).children 
          : [{ type: "text", value: description }];

        // 3. Reconstruct as MDAST nodes
        // This 'hidden' div contains the actual content of the directive
        const hiddenContent: any = {
          type: "parent",
          data: {
            hName: "div",
            hProperties: { class: "hidden" },
          },
          children: [...node.children], // Keep original children for basepath processing
        };

        // This is the password input UI
        const inputUI: any = {
          type: "parent",
          data: {
            hName: "div",
            hProperties: { class: "password-input" },
          },
          children: [
            {
              type: "paragraph",
              data: {
                hName: "span",
                hProperties: { class: "description" },
              },
              children: descriptionNodes, // Injected description (Gemoji/Link compatible)
            },
            {
              type: "paragraph",
              data: {
                hName: "span",
                hProperties: { class: "icon" },
              },
              children: [{ type: "text", value: "🔒" }],
            },
            {
              type: "paragraph",
              data: {
                hName: "input",
                hProperties: {
                  placeholder: "...",
                  type: "password",
                  "data-id": id,
                },
              },
              children: [],
            },
          ],
        };

        // 4. Overwrite node children so the pipeline visits them correctly
        node.children = [hiddenContent, inputUI];
      }
    });
  };
};
