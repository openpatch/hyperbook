import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkImage from "../src/remarkImage";
import remarkLink from "../src/remarkLink";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkLink(ctx))
    .use(remarkImage(ctx))
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md).value;
};

describe("remarkImage", () => {
  it("should render image with description", () => {
    expect(
      toHtml(
        `
![A description](/test.jpg)
`,
        ctx,
      ),
    ).toMatchSnapshot();
  });
  it("should render image with caption", () => {
    expect(
      toHtml(
        `
![A description](/test.jpg "A caption")
`,
        ctx,
      ),
    ).toMatchSnapshot();
  });
  it("should render as link", () => {
    expect(
      toHtml(
        `
[![A description](/test.jpg "A caption")](/elements/hints)
`,
        ctx,
      ),
    ).toMatchSnapshot();
  });
});
