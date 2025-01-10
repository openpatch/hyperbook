import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveTabs from "../src/remarkDirectiveTabs";
import { ctx } from "./mock";

export const toHtml = async (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTabs(ctx),
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

describe("remarkDirectiveTabs", () => {
  it("should transform", async () => {
    expect(
      (
        await toHtml(
          `::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::

Another tabs cluster with the same ids.
::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
:::
::::
`,
          ctx
        )
      ).value
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      (
        await toHtml(
          `::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::

Another tabs cluster with the same ids.
::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
:::
::::
`,
          ctx
        )
      ).data.directives?.["tabs"]
    ).toBeDefined();
  });
});
