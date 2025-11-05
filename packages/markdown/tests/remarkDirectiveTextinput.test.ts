import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveTextinput from "../src/remarkDirectiveTextinput";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTextinput(ctx),
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

describe("remarkDirectiveTextinput", () => {
  it("should transform with default attributes", async () => {
    const result = toHtml(
      `
::textinput
`,
      ctx,
    );
    expect(result.value).toContain('class="directive-textinput"');
    expect(result.value).toContain('class="textinput"');
    expect(result.value).toContain('<textarea');
    expect(result.value).toContain('data-id=');
  });

  it("should use placeholder attribute", async () => {
    const result = toHtml(
      `
::textinput{placeholder="Your solution"}
`,
      ctx,
    );
    expect(result.value).toContain('placeholder="Your solution"');
  });

  it("should use height attribute", async () => {
    const result = toHtml(
      `
::textinput{height="400px"}
`,
      ctx,
    );
    expect(result.value).toContain('height: 400px');
  });

  it("should use both placeholder and height attributes", async () => {
    const result = toHtml(
      `
::textinput{placeholder="Enter text here" height="300px"}
`,
      ctx,
    );
    expect(result.value).toContain('placeholder="Enter text here"');
    expect(result.value).toContain('height: 300px');
  });

  it("should use custom id if provided", async () => {
    const result = toHtml(
      `
::textinput{id="my-custom-id"}
`,
      ctx,
    );
    expect(result.value).toContain('data-id="my-custom-id"');
  });

  it("should register directive", async () => {
    const result = toHtml(
      `
::textinput
`,
      ctx,
    );
    expect(result.data.directives?.["textinput"]).toBeDefined();
    expect(result.data.directives?.["textinput"].scripts).toContain("client.js");
    expect(result.data.directives?.["textinput"].styles).toContain("style.css");
  });

  it("should create snapshot", async () => {
    expect(
      toHtml(
        `
::textinput{placeholder="Write your answer" height="250px"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
