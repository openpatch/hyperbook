/// <reference types="mdast-util-directive" />
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { icon } from "./icons";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import hash from "./objectHash";
import { Processor } from "unified";
import { resolvePassword } from "./resolvePassword";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) =>
  function (this: Processor) {
    const name = "protect";
    const processor = this;

    return async (tree: Root, file: VFile) => {
      visit(tree, (node) => {
        if (isDirective(node) && node.name === name) {
          const data = node.data || (node.data = {});
          expectContainerDirective(node, file, name);
          registerDirective(file, name, ["client.js"], ["style.css"], []);

          const {
            password: inlinePassword,
            use,
            description = "",
            id,
          } = node.attributes || {};

          // A shared groupId syncs several blocks: unlocking one unlocks all,
          // and it is the key the entered password is stored under. instanceId
          // is unique per block, so two blocks sharing a groupId still get
          // their own ciphertext.
          const groupId = id || hash(node);
          const instanceId = hash(node);

          const password = resolvePassword(ctx, file, {
            password: inlinePassword as string | undefined,
            use: use as string | undefined,
            where: "This :::protect block",
            node,
          });

          // 1. Setup the main container
          data.hName = "div";
          data.hProperties = {
            class: "directive-protect",
            "data-id": groupId,
            "data-instance": instanceId,
          };

          // The password travels to rehypeProtect out of band. Putting it on
          // the element — as `data-toast` used to — publishes it.
          if (!file.data.protect) {
            file.data.protect = {};
          }
          file.data.protect[instanceId] = { groupId, password };

          // 2. Parse the description and strip the paragraph wrapper
          const parsedDescription = processor.parse(description as string) as Root;
          const descriptionNodes =
            parsedDescription.children[0]?.type === "paragraph"
              ? (parsedDescription.children[0] as any).children
              : [{ type: "text", value: description }];

          // 3. Reconstruct as MDAST nodes
          // This 'hidden' div contains the actual content of the directive.
          // rehypeProtect serializes and encrypts it once the rest of the
          // pipeline has rendered it.
          const hiddenContent: any = {
            type: "parent",
            data: {
              hName: "div",
              hProperties: { class: "hidden" },
              // Marks the subtree as protected so the search index and the
              // heading collector can skip it.
              hyperbookProtected: true,
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
                  // This is an mdast node, so the hast icon has to be handed
                  // over as hChildren — mdast children would drop it.
                  hChildren: [icon("lock")],
                },
                children: [],
              },
              {
                type: "parent",
                data: {
                  hName: "div",
                  hProperties: { class: "controls" },
                },
                children: [
                  {
                    type: "paragraph",
                    data: {
                      hName: "input",
                      hProperties: {
                        placeholder: "...",
                        type: "password",
                        "data-id": groupId,
                      },
                    },
                    children: [],
                  },
                  // Deriving a key costs a few hundred milliseconds, so
                  // unlocking is an explicit action rather than a check on
                  // every keystroke.
                  {
                    type: "paragraph",
                    data: {
                      hName: "button",
                      hProperties: { type: "button", class: "unlock" },
                    },
                    children: [
                      { type: "text", value: i18n.get("protect-unlock") },
                    ],
                  },
                ],
              },
              {
                type: "paragraph",
                data: {
                  hName: "span",
                  hProperties: { class: "status", role: "status" },
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
