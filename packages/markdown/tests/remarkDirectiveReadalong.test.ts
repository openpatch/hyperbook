import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveReadalong from "../src/remarkDirectiveReadalong";
import remarkParse from "../src/remarkParse";

export const toHtml = async (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveReadalong(ctx),
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

describe("remarkDirectiveReadalong", () => {
  it("should transform with audio source", async () => {
    expect(
      (
        await toHtml(
          `
:::readalong{src="/audio.mp3"}
This is a test sentence for read-along functionality.
:::
`,
          ctx,
        )
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform with timestamps", async () => {
    const timestamps = JSON.stringify([
      { word: "This", start: 0, end: 0.5 },
      { word: "is", start: 0.5, end: 0.8 },
      { word: "a", start: 0.8, end: 1.0 },
      { word: "test", start: 1.0, end: 1.5 },
    ]);
    
    expect(
      (
        await toHtml(
          `
:::readalong{src="/audio.mp3" timestamps='${timestamps}'}
This is a test sentence for read-along functionality.
:::
`,
          ctx,
        )
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform with auto-generation enabled", async () => {
    expect(
      (
        await toHtml(
          `
:::readalong{src="/audio.mp3" autoGenerate="true" speed="120"}
This is a test sentence for read-along functionality.
:::
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
:::readalong{src="/audio.mp3"}
Test content
:::
`,
          ctx,
        )
      ).data.directives?.["readalong"],
    ).toBeDefined();
  });

  it("should handle multiple paragraphs", async () => {
    expect(
      (
        await toHtml(
          `
:::readalong{src="/audio.mp3"}
First paragraph of text.

Second paragraph of text.
:::
`,
          ctx,
        )
      ).value,
    ).toMatchSnapshot();
  });
});
