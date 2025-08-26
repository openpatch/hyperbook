import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkDirectiveYoutube from "../src/remarkDirectiveYoutube";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveYoutube(ctx),
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

describe("remarkDirectiveYoutube", () => {
  it("should add youtube to directives", async () => {
    expect(
      toHtml(`::youtube[Costa Rica]{#abc}`, ctx).data.directives?.["youtube"],
    ).toBeDefined();
  });
  it("should render", async () => {
    expect(
      toHtml(`::youtube[Costa Rica]{#LXb3EKWsInQ}`, ctx).value,
    ).toMatchSnapshot();
  });
  it("should fail on missing id", async () => {
    expect(() => toHtml(`::youtube[Costa Rica]`, ctx).value).toThrowError(
      `Missing id`,
    );
  });
  it("should fail on wrong column count", async () => {
    expect(
      toHtml(`:youtube[Costa Rica]{#LXb3EKWsInQ}`, ctx).messages.length,
    ).toBe(1);
  });
});
