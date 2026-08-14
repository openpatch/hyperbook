import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveJmp from "../src/remarkDirectiveJmp";
import remarkParse from "../src/remarkParse";
import { i18n } from "../src/i18n";

i18n.init("en");

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveJmp(ctx),
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

describe("remarkDirectiveJmp", () => {
  it("should transform", async () => {
    expect(
      toHtml(`\n::jmp{#list src="memory.jmp"}\n`, ctx).value,
    ).toMatchSnapshot();
  });

  it("should register directives", async () => {
    const result = toHtml(`\n::jmp{#list src="memory.jmp"}\n`, ctx);
    expect(result.data.directives?.["jmp"]).toBeDefined();
    expect(result.data.directives?.["jmp"].scripts).toContain("client.js");
    expect(result.data.directives?.["jmp"].scripts).toContain("jmp.umd.js");
    expect(result.data.directives?.["jmp"].styles).toContain("style.css");
    expect(result.data.directives?.["jmp"].styles).toContain(
      "web-component-jmp.css",
    );
  });

  it("should use the given height", async () => {
    expect(
      String(
        toHtml(`\n::jmp{#list src="memory.jmp" height="400px"}\n`, ctx).value,
      ),
    ).toContain("height: 400px");
  });

  it("should turn option attributes into an options object", async () => {
    const html = String(
      toHtml(
        `\n::jmp{#list src="memory.jmp" hide-sidebar inline-strings="false"}\n`,
        ctx,
      ).value,
    );
    expect(html).toContain(
      `options="{&#x22;hideSidebar&#x22;:true,&#x22;inlineStrings&#x22;:false}"`,
    );
  });

  it("should not set options when none are given", async () => {
    expect(
      String(toHtml(`\n::jmp{#list src="memory.jmp"}\n`, ctx).value),
    ).not.toContain("options=");
  });

  it("should report a missing src", async () => {
    const result = toHtml(`\n::jmp{#list}\n`, ctx);
    expect(result.messages.map((m) => String(m.reason))).toEqual([
      `Missing "src" attribute`,
    ]);
  });

  it("should report a file that does not exist", async () => {
    const result = toHtml(`\n::jmp{#list src="nope.jmp"}\n`, ctx);
    expect(result.messages.map((m) => String(m.reason))).toEqual([
      "File not found: nope.jmp",
    ]);
  });

  it("should report a file it cannot parse", async () => {
    const result = toHtml(`\n::jmp{#list src="broken.jmp"}\n`, ctx);
    expect(result.messages).toHaveLength(1);
    expect(String(result.messages[0].reason)).toContain(
      "Could not parse broken.jmp",
    );
  });
});
