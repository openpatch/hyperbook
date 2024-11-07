import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkDirectiveTerm from "../src/remarkDirectiveTerm";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTerm(ctx),
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

describe("remarkDirectiveTerm", () => {
  it("should render", async () => {
    expect(
      toHtml(`:t[Object-oriented Programming]{#oop.bluej-by-example}`, ctx)
        .value,
    ).toMatchSnapshot();
  });
  it("should infer id from text", async () => {
    expect(
      toHtml(`:t[Object-oriented Programming]`, ctx).value,
    ).toMatchSnapshot();
  });
  it("should work with term", async () => {
    expect(
      toHtml(`:term[Object-oriented Programming]`, ctx).value,
    ).toMatchSnapshot();
  });
  it("should fail without text", async () => {
    expect(() => toHtml(`:t{#oop}`, ctx).value).toThrowError("Only plain text");
  });
  it("should register directives", async () => {
    expect(
      toHtml(`:term[Object-oriented Programming]`, ctx).data.directives?.[
        "term"
      ],
    ).toBeDefined();
  });
});
