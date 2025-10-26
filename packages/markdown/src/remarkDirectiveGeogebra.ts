// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { isDirective, registerDirective } from "./remarkHelper";
import { toText } from "./mdastUtilToText";
import hash from "./objectHash";

export default (ctx: HyperbookContext) => () => {
  const name = "geogebra";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const {
          src = "",
          id = hash(node),
          height = 600,
          width = 800,
          showFullscreenButton = true,
          showResetIcon = true,
          ...props
        } = node.attributes || {};

        registerDirective(
          file,
          name,
          [
            "https://www.geogebra.org/apps/deployggb.js",
            "geogebra-web-component.js",
            "client.js",
          ],
          ["style.css"],
          [],
        );

        data.hName = "div";

        data.hProperties = {
          class: "directive-geogebra",
          style: `max-height: ${height}px; max-width: ${width}px; aspect-ratio: ${width}/${height};`,
        };

        const value = toText(node);
        data.hChildren = [
          {
            type: "element",
            tagName: "hyperbook-geogebra",
            properties: {
              ...props,
              height: height,
              width: width,
              borderRadius: 8,
              filename: src
                ? ctx.makeUrl(
                    src,
                    "public",
                    ctx.navigation.current || undefined,
                  )
                : undefined,
              language: ctx.config.language || "en",
              "data-id": id,
              showFullscreenButton,
              scaleContainerClass: "directive-geogebra",
              allowUpscale: true,
              showResetIcon,
            },
            children: [
              {
                type: "raw",
                value,
              },
            ],
          },
        ];
      }
    });
  };
};
