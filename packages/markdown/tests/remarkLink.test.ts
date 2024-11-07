import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkLink from "../src/remarkLink";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkLink(ctx))
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md).value;
};

describe("remarkLink", () => {
  it("should transform image link", () => {
    expect(
      toHtml(
        `
![A description](/test.jpg)
`,
        ctx,
      ),
    ).toMatchSnapshot();
  });
  it("should transform link", () => {
    expect(
      toHtml(
        `
[A description](/test.jpg)
`,
        ctx,
      ),
    ).toMatchSnapshot();
  });
});
