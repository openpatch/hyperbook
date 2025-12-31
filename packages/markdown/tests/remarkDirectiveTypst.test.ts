import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveTypst from "../src/remarkDirectiveTypst";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTypst(ctx),
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

describe("remarkDirectiveTypst", () => {
  it("should transform preview mode", async () => {
    expect(
      toHtml(
        `
:::typst{mode="preview"}

\`\`\`typ
= Hello World!
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform edit mode", async () => {
    expect(
      toHtml(
        `
:::typst{mode="edit"}

\`\`\`typ
= Hello World!

This is editable content.
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should default to preview mode", async () => {
    expect(
      toHtml(
        `
:::typst

\`\`\`typ
= Default Mode
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should register directives", async () => {
    expect(
      toHtml(
        `
:::typst{mode="preview"}

\`\`\`typ
= Test
\`\`\`

:::
`,
        ctx,
      ).data.directives?.["typst"],
    ).toBeDefined();
  });

  it("should accept custom height", async () => {
    const result = toHtml(
      `
:::typst{mode="preview" height=600}

\`\`\`typ
= Custom Height
\`\`\`

:::
`,
      ctx,
    ).value;
    expect(result).toContain("height: 600px");
  });

  it("should handle typst language code block", async () => {
    expect(
      toHtml(
        `
:::typst{mode="preview"}

\`\`\`typst
= Using typst language
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
