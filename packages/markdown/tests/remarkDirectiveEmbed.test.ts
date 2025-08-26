import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveEmbed from "../src/remarkDirectiveEmbed";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveEmbed(ctx),
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

describe("remarkDirectiveEmbed", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::embed{src="https://learningapps.org/watch?app=15767435"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::embed{src="https://learningapps.org/watch?app=15767435"}
`,
        ctx,
      ).data.directives?.["embed"],
    ).toBeDefined();
  });
});
