import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveCollapsible from "../src/remarkDirectiveCollapsible";
import remarkParse from "../src/remarkParse";

export const toHtml = async (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveCollapsible(ctx),
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
    .process(md);
};

describe("remarkDirectiveCollapsible", () => {
  it("should transform", async () => {
    expect(
      (
        await toHtml(
          `
::::collapsible{title="Hallo"}

This is a panel

::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann"}

:::collapsible{title="Nested"}

This is a stacked collapsible

::youtube[Test]{#124}

:::

This is normal Test in-between.

:::collapsible{title="With an Image"}

![](/test.jpg)

:::

::::
`,
          ctx,
        )
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      (
        await toHtml(
          `
:::collapsible{title="Nested"}

This is a stacked collapsible

::youtube[Test]{#124}

:::
`,
          ctx,
        )
      ).data.directives?.["collapsible"],
    ).toBeDefined();
  });
});
