import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkDirectiveVideo from "../src/remarkDirectiveVideo";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveVideo(ctx),
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

describe("remarkDirectiveVideo", () => {
  it("should transform with author and title", async () => {
    expect(
      toHtml(
        `::video{src="/clouds.mp4" poster="/clouds.jpg" title="Morgenwolken" author="Natureclip (CC-BY 3.0)"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform with author", async () => {
    expect(
      toHtml(
        `::video{src="/clouds.mp4" poster="/clouds.jpg" author="Natureclip (CC-BY 3.0)"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform with title", async () => {
    expect(
      toHtml(
        `::video{src="/clouds.mp4" poster="/clouds.jpg" title="Morgenwolken"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform with missing src", async () => {
    expect(
      toHtml(
        `::video{poster="/clouds.jpg" title="Morgenwolken"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform with missing src", async () => {
    expect(
      toHtml(
        `::video{poster="/clouds.jpg" title="Morgenwolken"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should fail on wrong column count", async () => {
    expect(
      toHtml(
        `:video{poster="/clouds.jpg" title="Morgenwolken"}
`,
        ctx,
      ).messages.length,
    ).toBe(1);
  });
  it("should register directives", async () => {
    expect(
      toHtml(`::video{poster="/clouds.jpg" title="Morgenwolken"}`, ctx).data
        .directives?.["video"],
    ).toBeDefined();
  });
});
