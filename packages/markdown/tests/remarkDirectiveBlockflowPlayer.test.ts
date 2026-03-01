import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveBlockflowPlayer from "../src/remarkDirectiveBlockflowPlayer";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveBlockflowPlayer(ctx),
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

describe("remarkDirectiveBlockflowPlayer", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should support custom dimensions", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3" width="800px" height="500px"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3"}
`,
        ctx,
      ).data.directives?.["blockflow-player"],
    ).toBeDefined();
  });
});
