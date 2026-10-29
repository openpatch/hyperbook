import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveSqlIde from "../src/remarkDirectiveSqlIde";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

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

  it("should add ::file sources as SQL files", async () => {
    const html = toHtml(
      `:::sqlide

\`\`\`mysql
SELECT * from fluss;
\`\`\`

::file{path="setup.sql" src="sqlide-setup.sql"}

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain(
      '<script type="text/plain" title="setup.sql" data-type="sql">',
    );
    expect(html).toContain("CREATE TABLE fluss");
  });

  it("should add a Markdown ::file source as a hint", async () => {
    const html = toHtml(
      `:::sqlide

\`\`\`mysql
SELECT 1;
\`\`\`

::file{path="tip.md" src="sqlide-tip.md"}

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain(
      '<script type="text/plain" title="tip.md" data-type="hint">',
    );
  });

  it("should report a ::file whose source is missing", async () => {
    const result = toHtml(
      `:::sqlide

\`\`\`mysql
SELECT 1;
\`\`\`

::file{path="setup.sql" src="missing.sql"}

:::
`,
      ctx,
    );
    expect(result.messages.map((m) => m.reason).join("\n")).toContain(
      '::file in the sqlide directive: "missing.sql" was not found.',
    );
  });
});
