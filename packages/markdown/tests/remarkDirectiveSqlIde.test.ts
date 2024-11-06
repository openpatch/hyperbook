import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveSqlIde from "../src/remarkDirectiveSqlIde";
import { ctx } from "./mock";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveSqlIde(ctx),
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

describe("remarkDirectiveSqlIde", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `:::sqlide{height=500}

\`\`\`mysql Statements.sql

SELECT * from fluss;

\`\`\`

\`\`\`md A Hint

Do this

\`\`\`
:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
