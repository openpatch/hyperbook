import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectivePyide from "../src/remarkDirectivePyide";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectivePyide(ctx),
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

describe("remarkDirectivePyide", () => {
  it("should transform basic pyide", async () => {
    expect(
      toHtml(
        `:::pyide

\`\`\`python
print("Hello World")
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with canvas attribute", async () => {
    expect(
      toHtml(
        `:::pyide{canvas}

\`\`\`python
import pygame
pygame.init()
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with packages attribute", async () => {
    expect(
      toHtml(
        `:::pyide{packages="snowballstemmer, nltk"}

\`\`\`python
import snowballstemmer
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with canvas and packages attributes", async () => {
    expect(
      toHtml(
        `:::pyide{canvas packages="pytamaro"}

\`\`\`python
from pytamaro import *
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
