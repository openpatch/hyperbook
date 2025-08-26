import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";
import remarkSubSup from "../src/remarkSubSup";
import remarkGfm from "remark-gfm";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkSubSup)
    .use(remarkGfm)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md).value;
};

describe("remarkSubSup", () => {
  it("should transform subscript", () => {
    expect(
      toHtml(
        `
H_{2}0
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>H<sub>2</sub>0</p>
      "
    `);
  });

  it("should not transform link", () => {
    expect(
      toHtml(
        `
[https://docs.nextcloud.com/server/latest/user_manual/en/groupware/sync_android.html#with-the-nextcloud-mobile-app](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/sync_android.html#with-the-nextcloud-mobile-app)
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p><a href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/sync_android.html#with-the-nextcloud-mobile-app">https://docs.nextcloud.com/server/latest/user_manual/en/groupware/sync_android.html#with-the-nextcloud-mobile-app</a></p>
      "
    `);
  });

  it("should not transform subscript", () => {
    expect(
      toHtml(
        `
H\\_{2}0
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>H_{2}0</p>
      "
    `);
  });
  it("should transform superscript", () => {
    expect(
      toHtml(
        `
f^{2}(x)
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>f<sup>2</sup>(x)</p>
      "
    `);
  });

  it("should not transform superscript", () => {
    expect(
      toHtml(
        `
f\\^{2}(x)
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>f^{2}(x)</p>
      "
    `);
  });

  it("should not transform strikethrough", () => {
    expect(
      toHtml(
        `
~~2~~
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p><del>2</del></p>
      "
    `);
  });
});
