import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import { realCtx } from "./mock";
import remarkCollectSearchDocuments from "../src/remarkCollectSearchDocuments";
import rehypeStringify from "rehype-stringify";
import remarkParse from "../src/remarkParse";

export const toData = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkCollectSearchDocuments(ctx))
    .use(remarkToRehype)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("remarkCollectSearchDocuments", () => {
  it("should transform", async () => {
    expect(
      toData(
        `
# Heading

heading

## Sub-Heading 1

sub-heading 1

## Sub-Heading 2

sub-heading 2

### Subsub-heading 1

subsub-heading 1
`,
        realCtx,
      ).data.searchDocuments,
    ).toMatchInlineSnapshot(`
      [
        {
          "content": "Heading heading Sub-Heading 1 sub-heading 1 Sub-Heading 2 sub-heading 2 Subsub-heading 1 subsub-heading 1",
          "description": "",
          "heading": "Heading",
          "href": "/markdown#heading",
          "keywords": [],
        },
        {
          "content": "Sub-Heading 1 sub-heading 1",
          "description": "",
          "heading": "Sub-Heading 1",
          "href": "/markdown#subheading-1",
          "keywords": [],
        },
        {
          "content": "Sub-Heading 2 sub-heading 2 Subsub-heading 1 subsub-heading 1",
          "description": "",
          "heading": "Sub-Heading 2",
          "href": "/markdown#subheading-2",
          "keywords": [],
        },
        {
          "content": "Subsub-heading 1 subsub-heading 1",
          "description": "",
          "heading": "Subsub-heading 1",
          "href": "/markdown#subsubheading-1",
          "keywords": [],
        },
      ]
    `);
  });
});
