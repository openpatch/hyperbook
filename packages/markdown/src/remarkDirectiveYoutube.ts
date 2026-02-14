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
  const name = "youtube";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const { id } = attributes;

        expectLeafDirective(node, file, name);

        if (id == null) {
          file.fail(
            `[youtube] Missing id, use ::youtube{#iasd} (${ctx.navigation.current?.href})`,
            node,
          );
        }

        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const iframeSrc = "https://www.youtube-nocookie.com/embed/" + id;
        const iframeTitle =
          typeof data.hChildren === "string" ? data.hChildren : "";

        data.hName = "div";
        data.hProperties = {
          class: "directive-youtube",
          id: `video-${id}`,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "directive-youtube-consent",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { class: "directive-youtube-consent-banner" },
                children: [
                  {
                    type: "element",
                    tagName: "p",
                    properties: { class: "directive-youtube-consent-banner-text" },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("consent-youtube-text"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "p",
                    properties: { class: "directive-youtube-consent-banner-text" },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("consent-youtube-nocookie"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "label",
                    properties: { class: "directive-youtube-consent-always-label" },
                    children: [
                      {
                        type: "element",
                        tagName: "input",
                        properties: {
                          type: "checkbox",
                          class: "directive-youtube-consent-always-checkbox",
                        },
                        children: [],
                      },
                      {
                        type: "text",
                        value: i18n.get("consent-youtube-always"),
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: { class: "directive-youtube-consent-accept-btn" },
                    children: [
                      { type: "text", value: i18n.get("consent-youtube-accept") },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "iframe",
                properties: {
                  class: "player",
                  "data-consent-src": iframeSrc,
                  frameBorder: "0",
                  title: iframeTitle,
                  allow:
                    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
                },
                children: [],
              },
            ],
          },
        ];
      }
    });
  };
};
