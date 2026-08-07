import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkRehype from "remark-rehype";
import remarkGfm from "remark-gfm";
import rehypeStringify from "rehype-stringify";
import { ctx } from "./mock";
import remarkHeadings from "../src/remarkHeadings";
import remarkParse from "../src/remarkParse";

describe("remarkHeadingId", () => {
  it("should parse well", async () => {
    let file = await unified()
      .use(remarkParse)
      .use(remarkHeadings(ctx))
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
      }).process(`# head
# cus head1 {#idd-id}
# cus head2 {#idd id}
# cus head3 {#中文 id}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
      "<h1 id="head"><a href="#head" class="heading"><span>head</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#head" data-label="head">🔖</button></h1>
      <h1 id="cus-head1"><a href="#cus-head1" class="heading"><span>cus head1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head1" data-label="cus head1">🔖</button></h1>
      <h1 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head2" data-label="cus head2">🔖</button></h1>
      <h1 id="cus-head3"><a href="#cus-head3" class="heading"><span>cus head3</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head3" data-label="cus head3">🔖</button></h1>"
    `);
  });

  it("should not put the label into executable markup", async () => {
    // A quote or a backslash in a heading used to end up inside a JavaScript
    // string in an onclick attribute, which made the bookmark button throw.
    let file = await unified()
      .use(remarkParse)
      .use(remarkHeadings(ctx))
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
      })
      .process(`# He said "hi" and \\ backslash`);

    const html = String(file);
    expect(html).not.toContain("onclick");
    expect(html).toContain(
      `data-label="He said &#x22;hi&#x22; and \\ backslash"`,
    );
    expect(html).toContain(`aria-pressed="false"`);
  });

  it("should parse well which contains inline syntax", async () => {
    let file = await unified()
      .data("settings", {})
      .use(remarkParse)
      .use(remarkHeadings(ctx))
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
      }).process(`
# cus \`head1\` {#idd-id}
## cus **head2** {#idd id}
## cus ~~head2~~  {#idd id}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
      "<h1 id="cus-head1"><a href="#cus-head1" class="heading"><span>cus head1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head1" data-label="cus head1">🔖</button></h1>
      <h2 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head2" data-label="cus head2">🔖</button></h2>
      <h2 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2 </span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#cus-head2" data-label="cus head2 ">🔖</button></h2>"
    `);
  });

  it("should result in a heading with a colon", async () => {
    let file = await unified()
      .use(remarkParse)
      .use(remarkHeadings(ctx))
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
      }).process(`# Heading 1:1
      `);

    expect(String(file)).toMatchInlineSnapshot(
      `"<h1 id="heading-11"><a href="#heading-11" class="heading"><span>Heading 1:1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-pressed="false" data-key="#heading-11" data-label="Heading 1:1">🔖</button></h1>"`,
    );
  });
});
