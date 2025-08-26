import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import rehypeDirectiveP5 from "../src/rehypeDirectiveP5";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [remarkDirective, remarkDirectiveRehype];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeDirectiveP5(ctx))
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("remarkDirectiveEmbed", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::p5{src="testp5.js"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::p5{src="testp5.js"}
`,
        ctx,
      ).data.directives?.["p5"],
    ).toBeDefined();
  });
});
