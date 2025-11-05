import { visit } from "unist-util-visit";
import { Image, Root } from "mdast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";
import { ElementContent } from "hast";

export default (ctx: HyperbookContext) => () => {
  return function (tree: Root, file: VFile) {
    visit(tree, "image", (node: Image) => {
      if (!node.data) {
        node.data = {
          hChildren: [],
        };
      }

      const children: ElementContent[] = [];
      if (node.title) {
        children.push({
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [
            {
              type: "text",
              value: node.title,
            },
          ],
        });
      }
      node.data.hName = "figure";
      let figureProps = node.data.hProperties;
      node.data.hProperties = {
        class: "normal " + figureProps?.class,
      };
      node.data.hChildren = [
        {
          type: "element",
          tagName: "img",
          properties: {
            ...figureProps,
            src: ctx.makeUrl(
              node.url,
              "public",
              ctx.navigation.current || undefined,
            ),
            alt: node.alt,
            onclick: `hyperbook.toggleLightbox(this)`,
          },
          children: [],
        },
        ...children,
      ];
    });
  };
};
