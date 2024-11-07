import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import rehypeTableOfContents from "../src/rehypeTableOfContents";
import remarkCollectHeadings from "../src/remarkCollectHeadings";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkCollectHeadings(ctx))
    .use(remarkToRehype)
    .use(rehypeTableOfContents(ctx))
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("remarkTableOfContents", () => {
  it("should generate toc", async () => {
    expect(
      toHtml(
        `# H1
## H2a

### H3b

## H2b

### H3b`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
