import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm from "remark-gfm";
import rehypeStringify from "rehype-stringify";

import { remarkCustomHeadingIds } from "../src/remarkCustomHeadingIds";

describe("remarkHeadingId", () => {
  it("should parse well", async () => {
    let file = await unified()
      .data("settings", {
        position: false,
      })
      .use(remarkParse)
      .use(remarkCustomHeadingIds)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify).process(`# head
# cus head1 {#idd-id}
# cus head2 {#idd id}
# cus head3 {#中文 id}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
"<h1>head</h1>
<h1 id=\\"idd-id\\">cus head1</h1>
<h1 id=\\"idd id\\">cus head2</h1>
<h1 id=\\"中文 id\\">cus head3</h1>"
`);
  });

  it("should parse well which contains inline syntax", async () => {
    let file = await unified()
      .data("settings", {
        position: false,
      })
      .use(remarkParse)
      .use(remarkCustomHeadingIds)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify).process(`
# cus \`head1\` {#idd-id}
## cus **head2** {#idd id}
## cus ~~head2~~  {#idd id}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
"<h1 id=\\"idd-id\\">cus <code>head1</code></h1>
<h2 id=\\"idd id\\">cus <strong>head2</strong></h2>
<h2 id=\\"idd id\\">cus <del>head2</del> </h2>"
`);
  });
});
