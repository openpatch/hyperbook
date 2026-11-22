import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkRehype from "remark-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
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
# cus head2 {#idd id2}
# cus head3 {#中文 id}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
      "<h1 id="head"><a href="#head" class="heading"><span>head</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#head" data-label="head"></button></h1>
      <h1 id="idd-id"><a href="#idd-id" class="heading"><span>cus head1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#idd-id" data-label="cus head1"></button></h1>
      <h1 id="idd-id2"><a href="#idd-id2" class="heading"><span>cus head2</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#idd-id2" data-label="cus head2"></button></h1>
      <h1 id="中文-id"><a href="#中文-id" class="heading"><span>cus head3</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#中文-id" data-label="cus head3"></button></h1>"
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
    // The icon is drawn by the stylesheet, not by the emoji font.
    expect(html).toContain(`<button type="button" class="bookmark"`);
    expect(html).not.toContain("🔖");
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
# cus \`head1\` {#code}
## cus **head2** {#bold}
## cus ~~head2~~  {#strike}
      `);

    expect(String(file)).toMatchInlineSnapshot(`
      "<h1 id="code"><a href="#code" class="heading"><span>cus head1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#code" data-label="cus head1"></button></h1>
      <h2 id="bold"><a href="#bold" class="heading"><span>cus head2</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#bold" data-label="cus head2"></button></h2>
      <h2 id="strike"><a href="#strike" class="heading"><span>cus head2 </span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#strike" data-label="cus head2 "></button></h2>"
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
      `"<h1 id="heading-11"><a href="#heading-11" class="heading"><span>Heading 1:1</span></a><button type="button" class="bookmark" title="toggle-bookmark" aria-label="toggle-bookmark" aria-pressed="false" data-key="#heading-11" data-label="Heading 1:1"></button></h1>"`,
    );
  });

  // Math is content, not styling, so it survives into the heading and is
  // rendered by KaTeX. Only the plain text labels (anchor, bookmark, table of
  // contents) keep the TeX source.
  const renderMath = (md: string) =>
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkHeadings(ctx))
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify, {
        allowDangerousCharacters: true,
        allowDangerousHtml: true,
      })
      .process(md);

  it("should render math in a heading", async () => {
    const html = String(await renderMath(`# Cost of $x^2$ math`));

    // KaTeX rendered the formula: the TeX source is in the MathML annotation.
    expect(html).toContain(`encoding="application/x-tex">x^2</annotation>`);
    // The text around the formula is still there, in order.
    expect(html).toMatch(/<span>Cost of <span class="katex">.* math<\/span>/);
    // The anchor and the labels are plain text, without the delimiters.
    expect(html).toContain(`id="cost-of-x2-math"`);
    expect(html).toContain(`data-label="Cost of x^2 math"`);
    expect(html).not.toContain(`$`);
  });

  it("should render math in a heading next to a custom id", async () => {
    const html = String(await renderMath(`## $E = mc^2$ {#energy}`));

    expect(html).toContain(
      `encoding="application/x-tex">E = mc^2</annotation>`,
    );
    expect(html).toContain(`id="energy"`);
    expect(html).toContain(`href="#energy"`);
    // The custom id marker is stripped from the heading text.
    expect(html).not.toContain("{#energy}");
  });

  it("should render display math in a heading inline", async () => {
    // `$$…$$` has to stay inline: a display block cannot live in a heading.
    const html = String(await renderMath(`## $$x$$`));

    expect(html).toContain(`encoding="application/x-tex">x</annotation>`);
    expect(html).not.toContain("katex-display");
  });

  it("should not break the build on broken math", async () => {
    // rehype-katex reports the error on the file instead of throwing.
    const file = await renderMath(`# Broken $\\frac{$ math`);

    expect(file.messages.length).toBeGreaterThan(0);
    expect(String(file)).toContain("Broken");
  });

  it("should keep math outside of a heading unchanged", async () => {
    const html = String(await renderMath(`Text with $x$ math`));

    expect(html).toContain(`encoding="application/x-tex">x</annotation>`);
    expect(html).toContain(`<p>Text with <span class="katex">`);
  });
});
