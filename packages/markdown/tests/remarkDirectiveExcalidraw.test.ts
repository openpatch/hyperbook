import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveExcalidraw from "../src/remarkDirectiveExcalidraw";
import remarkParse from "../src/remarkParse";
import { i18n } from "../src/i18n";

i18n.init("en");

const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveExcalidraw(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeStringify)
    .processSync(md);
};

describe("remarkDirectiveExcalidraw", () => {
  it("passes the id attribute to the element", () => {
    const html = toHtml(
      `\n::excalidraw{#sketch src="/a.excalidraw" edit=true}\n`,
      ctx,
    ).value as string;
    expect(html).toMatch(/<hyperbook-excalidraw[^>]* id="sketch"/);
  });

  it("generates distinct ids for elements sharing a template", () => {
    const html = toHtml(
      `\n::excalidraw{src="/a.excalidraw" edit=true}\n\n::excalidraw{src="/a.excalidraw" edit=true aspectRatio="4/3"}\n`,
      ctx,
    ).value as string;
    const ids = [...html.matchAll(/<hyperbook-excalidraw[^>]* id="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toEqual(ids[1]);
  });

  it("passes the book language and reset texts", () => {
    const html = toHtml(`\n::excalidraw{src="/a.excalidraw" edit=true}\n`, ctx)
      .value as string;
    expect(html).toContain('reset-label="Reset to template"');
    expect(html).toMatch(/ lang="[a-z]+"/);
  });
});
