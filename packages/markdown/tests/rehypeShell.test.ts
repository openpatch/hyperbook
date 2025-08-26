import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import rehypeTableOfContents from "../src/rehypeTableOfContents";
import rehypeShell from "../src/rehypeShell";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(rehypeShell(ctx))
    .use(rehypeTableOfContents(ctx))
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("rehypeShell", () => {
  const virtualCtx: HyperbookContext = {
    ...ctx,
    navigation: {
      ...ctx.navigation,
      sections: [
        {
          virtual: true,
          name: "__I_AM_NOT_HERE",
          sections: [],
          pages: [],
        },
        {
          virtual: false,
          name: "__I_AM_HERE",
          sections: [],
          pages: [],
        },
      ],
    },
  };
  it("should hide virtual section", async () => {
    const value = toHtml("", virtualCtx).value;
    expect(value).toContain("__I_AM_HERE");
    expect(value).not.toContain("__I_AM_NOT_HERE");
  });
});
