import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveAudio from "../src/remarkDirectiveAudio";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveAudio(ctx),
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

describe("remarkDirectiveAudio", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}
`,
        ctx,
      ).data.directives?.["audio"],
    ).toBeDefined();
  });
});
