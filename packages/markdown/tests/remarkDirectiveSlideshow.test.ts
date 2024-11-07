import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveSlideshow from "../src/remarkDirectiveSlideshow";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveSlideshow(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("remarkDirectiveSlideshow", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `:::slideshow
![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")
:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `:::slideshow

![Test](/test.jpg "A caption")
![Clouds](/clouds.jpg "Another caption")

:::
`,
        ctx,
      ).data.directives?.["slideshow"],
    ).toBeDefined();
  });
});
