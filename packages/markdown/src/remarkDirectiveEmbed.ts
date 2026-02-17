// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { i18n } from "./i18n";

export default (ctx: HyperbookContext) => () => {
  const name = "embed";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        const {
          aspectRatio,
          width = "100%",
          height = "400px",
          src,
          allowFullScreen = true,
          title,
          consent = "true",
        } = node.attributes || {};

        const useConsent = consent !== "false";

        if (useConsent) {
          registerDirective(file, name, ["client.js"], ["style.css"], []);

          let domain = src || "";
          try {
            domain = new URL(src || "").hostname;
          } catch (e) {}

          data.hName = "div";
          data.hProperties = {
            class: "directive-embed",
            style: `aspect-ratio: ${aspectRatio}; height: ${height}; width: ${width}`,
          };
          data.hChildren = [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "consent",
                "data-consent-src": src,
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: { class: "consent-banner" },
                  children: [
                    {
                      type: "element",
                      tagName: "p",
                      properties: { class: "consent-banner-text" },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("consent-embed-text"),
                        },
                        {
                          type: "element",
                          tagName: "br",
                          properties: {},
                          children: [],
                        },
                        {
                          type: "element",
                          tagName: "br",
                          properties: {},
                          children: [],
                        },
                        {
                          type: "text",
                          value: i18n.get("consent-embed-personal-data"),
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "p",
                      properties: { class: "directive-embed-consent-banner-url" },
                      children: [
                        { type: "text", value: "URL: " },
                        {
                          type: "element",
                          tagName: "a",
                          properties: {
                            href: src,
                            target: "_blank",
                            rel: "noopener noreferrer",
                          },
                          children: [{ type: "text", value: src || "" }],
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "label",
                      properties: {
                        class: "consent-always-label",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "input",
                          properties: {
                            type: "checkbox",
                            class: "consent-always-checkbox",
                          },
                          children: [],
                        },
                        {
                          type: "text",
                          value: i18n.get("consent-embed-always", { domain }),
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "button",
                      properties: {
                        class: "consent-accept-btn",
                      },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("consent-embed-accept"),
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "iframe",
                  properties: {
                    "data-consent-src": src,
                    title,
                    allowfullscreen: allowFullScreen,
                  },
                  children: [],
                },
              ],
            },
          ];
        } else {
          registerDirective(file, name, [], ["style.css"], []);

          data.hName = "div";
          data.hProperties = {
            class: "directive-embed",
            style: `aspect-ratio: ${aspectRatio}; height: ${height}; width: ${width}`,
          };
          data.hChildren = [
            {
              type: "element",
              tagName: "iframe",
              properties: {
                src,
                title,
                allowfullscreen: allowFullScreen,
              },
              children: [],
            },
          ];
        }
      }
    });
  };
};
