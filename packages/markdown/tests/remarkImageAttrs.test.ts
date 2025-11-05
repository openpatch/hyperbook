import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import remarkImage from "../src/remarkImage";
import remarkLink from "../src/remarkLink";
import remarkParse from "../src/remarkParse";
import remarkImageAttrs from "../src/remarkImageAttrs";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(remarkLink(ctx))
    .use(remarkImageAttrs(ctx))
    .use(remarkImage(ctx))
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md).value;
};

describe("remarkImageAttrs", () => {
  it("should render image with left", () => {
    expect(
      toHtml(
        `
-![Alt](left.jpg)
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/left.jpg" alt="Alt" class="normal align-left">
          <img class="align-left" src="/public/public/left.jpg" alt="Alt" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
  it("should render image with leftplus", () => {
    expect(
      toHtml(
        `
--![Alt](leftplus.jpg)
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/leftplus.jpg" alt="Alt" class="normal align-leftplus">
          <img class="align-leftplus" src="/public/public/leftplus.jpg" alt="Alt" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
  it("should render image with right", () => {
    expect(
      toHtml(
        `
![Alt](right.jpg)-
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/right.jpg" alt="Alt" class="normal align-right">
          <img class="align-right" src="/public/public/right.jpg" alt="Alt" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
  it("should render image with rightplus", () => {
    expect(
      toHtml(
        `
![Alt](rightplus.jpg)--
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/rightplus.jpg" alt="Alt" class="normal align-rightplus">
          <img class="align-rightplus" src="/public/public/rightplus.jpg" alt="Alt" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
  it("should render image with centerplus", () => {
    expect(
      toHtml(
        `
--![Alt](centerplus.jpg)--
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/centerplus.jpg" alt="Alt" class="normal align-centerplus">
          <img class="align-centerplus" src="/public/public/centerplus.jpg" alt="Alt" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
  it("should render image with centerplus", () => {
    expect(
      toHtml(
        `
![](normal.jpg){#hero .rounded width="200"}
`,
        ctx,
      ),
    ).toMatchInlineSnapshot(`
      "
      <p>
        <figure src="/public/normal.jpg" alt="" class="normal rounded">
          <img width="200" id="hero" class="rounded" src="/public/public/normal.jpg" alt="" onclick="hyperbook.toggleLightbox(this)">
        </figure>
      </p>
      "
    `);
  });
});
