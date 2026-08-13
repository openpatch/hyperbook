import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import { realCtx } from "./mock";
import remarkCollectSearchDocuments from "../src/remarkCollectSearchDocuments";
import rehypeStringify from "rehype-stringify";
import remarkParse from "../src/remarkParse";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveProtect from "../src/remarkDirectiveProtect";

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

/** Mirrors the real pipeline: protect runs before the collector. */
const toDataWithProtect = (md: string, ctx: HyperbookContext) =>
  unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkDirectiveRehype)
    .use(remarkDirectiveProtect(ctx))
    .use(remarkCollectSearchDocuments(ctx))
    .use(remarkToRehype)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .process(md);

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

  it("should not index the content of a protect block", async () => {
    const data = (
      await toDataWithProtect(
        `
# Heading

visible prose

:::protect{password="pw"}

the protected secret

## Protected Heading

more secrets

:::

trailing prose
`,
        realCtx,
      )
    ).data.searchDocuments;

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("the protected secret");
    expect(serialized).not.toContain("more secrets");
    expect(serialized).not.toContain("Protected Heading");
    expect(serialized).not.toContain("pw");

    // The surrounding prose is still indexed.
    expect(data?.[0].content).toContain("visible prose");
    expect(data?.[0].content).toContain("trailing prose");
  });

  it("should index nothing on a protected page", async () => {
    const protectedCtx = {
      ...realCtx,
      navigation: {
        ...realCtx.navigation,
        current: { ...realCtx.navigation.current, protect: "chapter-3" },
      },
    } as HyperbookContext;

    const data = (
      await toDataWithProtect(
        `# Heading\n\nsecret page content\n`,
        protectedCtx,
      )
    ).data.searchDocuments;

    expect(data).toEqual([]);
  });
});
