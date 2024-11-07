import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import rehypeFormat from "rehype-format";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveTiles from "../src/remarkDirectiveTiles";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTiles(ctx),
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

describe("remarkDirectiveTiles", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `:::tiles

::tile{title="Hallo"}

::tile{title="A tile with a link" href="openpatch.org"}

::tile{title="A large tile" size="L"}

::tile{title="A small tile" size="S"}

::tile{title="A icon tile" icon="https://www.inf-schule.de/assets/img/icons/icon_algorithmen.png"}

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `:::tiles

::tile{title="Hallo"}

::tile{title="A tile with a link" href="openpatch.org"}

::tile{title="A large tile" size="L"}

::tile{title="A small tile" size="S"}

::tile{title="A icon tile" icon="https://www.inf-schule.de/assets/img/icons/icon_algorithmen.png"}

:::
`,
        ctx,
      ).data.directives?.["tiles"],
    ).toBeDefined();
  });
});
