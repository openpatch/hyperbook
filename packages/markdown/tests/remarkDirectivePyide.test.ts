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

  it("should survive a round trip through data-tests with non-ASCII code", async () => {
    // The tests are stored base64-encoded in data-tests and decoded again by
    // assets/directive-pyide/src/index.js. Buffer.from() encodes UTF-8 *bytes*,
    // so the client has to decode them as UTF-8 -- a bare atob() hands back one
    // character per byte and mangles every assertion message a learner reads.
    const testCode = 'assert groesse > 0, "Die Größe muss größer als 0 sein"';

    const html = String(
      toHtml(
        `:::pyide

\`\`\`python
groesse = 20
\`\`\`

\`\`\`python test
${testCode}
\`\`\`

:::
`,
        ctx,
      ).value,
    );

    const encoded = html.match(/data-tests="([^"]*)"/)?.[1];
    expect(encoded).toBeDefined();

    // exactly what index.js does
    const bytes = Uint8Array.from(atob(encoded!), (c) => c.charCodeAt(0));
    const tests = JSON.parse(new TextDecoder().decode(bytes));
    expect(tests).toHaveLength(1);
    expect(tests[0].code).toBe(testCode);

    // and why it has to: the shortcut mangles every non-ASCII character
    expect(atob(encoded!)).toContain("GrÃ¶Ã\u009fe");
  });
});
