import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkCollectHeadings from "../src/remarkCollectHeadings";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [remarkCollectHeadings(ctx)];

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

describe("remarkCollectHeadings", () => {
  it("should collect", async () => {
    expect(
      toHtml(
        `# H1
## H2a

### H3b

## H2b

### H3b`,
        ctx,
      ).data,
    ).toMatchSnapshot();
  });
});
