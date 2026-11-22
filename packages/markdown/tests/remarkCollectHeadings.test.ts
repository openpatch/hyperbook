import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkCollectHeadings from "../src/remarkCollectHeadings";
import remarkHeadings from "../src/remarkHeadings";
import remarkParse from "../src/remarkParse";

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

  it("should collect the custom id of a heading", async () => {
    // The table of contents, the search index and the share dialog link with
    // these anchors, so they have to be the ids the headings render.
    const md = "# Stable H1 {#stable}\n## Changed text {#unchanged}";
    const file = await unified()
      .use(remarkParse)
      .use([remarkHeadings(ctx), remarkCollectHeadings(ctx)])
      .use(remarkToRehype)
      .use(rehypeStringify)
      .process(md);

    expect(
      (file.data.headings || []).map((heading) => [
        heading.label,
        heading.anchor,
      ]),
    ).toEqual([
      ["Stable H1", "stable"],
      ["Changed text", "unchanged"],
    ]);
  });
});
