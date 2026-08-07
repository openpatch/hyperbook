import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkLink from "../src/remarkLink";
import remarkParse from "../src/remarkParse";

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
  it("should keep mailto links", () => {
    const html = toHtml(`[Write us](mailto:contact@openpatch.org)`, ctx);
    expect(html).toContain(`href="mailto:contact@openpatch.org"`);
    expect(html).not.toContain("target");
  });
  it("should keep tel links", () => {
    const html = toHtml(`[Call us](tel:+4912345678)`, ctx);
    expect(html).toContain(`href="tel:+4912345678"`);
  });
  it("should keep external links and open them in a new tab", () => {
    const html = toHtml(`[OpenPatch](https://openpatch.org)`, ctx);
    expect(html).toContain(`href="https://openpatch.org"`);
    expect(html).toContain(`target="_blank"`);
  });
});
