import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm from "remark-gfm";
import rehypeStringify from "rehype-stringify";
import { ctx } from "./mock";
import remarkHeadings from "../src/remarkHeadings";

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
      "<h1 id="head"><a href="#head" class="heading"><span>head</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#head&#x22;, &#x22;head&#x22;)" title="Bookmark" data-key="#head">🔖</button></h1>
      <h1 id="cus-head1"><a href="#cus-head1" class="heading"><span>cus head1</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head1&#x22;, &#x22;cus head1&#x22;)" title="Bookmark" data-key="#cus-head1">🔖</button></h1>
      <h1 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head2&#x22;, &#x22;cus head2&#x22;)" title="Bookmark" data-key="#cus-head2">🔖</button></h1>
      <h1 id="cus-head3"><a href="#cus-head3" class="heading"><span>cus head3</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head3&#x22;, &#x22;cus head3&#x22;)" title="Bookmark" data-key="#cus-head3">🔖</button></h1>"
    `);
  });

  it("should parse well which contains inline syntax", async () => {
    let file = await unified()
      .data("settings", {
        position: false,
      })
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
      "<h1 id="cus-head1"><a href="#cus-head1" class="heading"><span>cus head1</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head1&#x22;, &#x22;cus head1&#x22;)" title="Bookmark" data-key="#cus-head1">🔖</button></h1>
      <h2 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2</span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head2&#x22;, &#x22;cus head2&#x22;)" title="Bookmark" data-key="#cus-head2">🔖</button></h2>
      <h2 id="cus-head2"><a href="#cus-head2" class="heading"><span>cus head2 </span></a><button class="bookmark" onclick="hyperbook.toggleBookmark(&#x22;#cus-head2&#x22;, &#x22;cus head2 &#x22;)" title="Bookmark" data-key="#cus-head2">🔖</button></h2>"
    `);
  });
});
