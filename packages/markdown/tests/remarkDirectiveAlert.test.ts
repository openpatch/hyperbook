import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveAlert from "../src/remarkDirectiveAlert";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveAlert(ctx),
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

describe("remarkDirectiveAlert", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
:::alert
Default
:::

:::alert{error}
Error
:::

:::alert{success}
Success
:::

:::alert{info}
Info
:::

:::alert{warn}
Warn
:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should use color and label attributes", async () => {
    expect(
      toHtml(
        `
:::alert{color="#FF00FF" label="D"}
Warn
:::
`,
        ctx,
      ).value,
    ).toMatchInlineSnapshot(`
      "
      <div class="directive-alert color label icon" style="--alert-color: #FF00FF; --alert-content: 'D';">
        <p>Warn</p>
      </div>
      "
    `);
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
:::alert
Default
:::
`,
        ctx,
      ).data.directives?.["alert"],
    ).toBeDefined();
  });
});
