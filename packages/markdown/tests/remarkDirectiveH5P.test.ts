import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import remarkDirectiveH5P from "../src/remarkDirectiveH5P";
import remarkParse from "../src/remarkParse";
import { ctx } from "./mock";

const render = (markdown: string, context: HyperbookContext = ctx) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkDirectiveRehype)
      .use(remarkDirectiveH5P(context))
      .use(remarkToRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  );

describe("remarkDirectiveH5P", () => {
  it("keeps export disabled by default", () => {
    expect(render('::h5p{src="/test.h5p"}')).not.toContain("data-export");
  });

  it("enables export and points it to the retained source archive", () => {
    const html = render('::h5p{src="/test.h5p" export}');

    expect(html).toContain('data-export="true"');
    expect(html).toContain('data-download-url="/public/test.h5p/test.h5p"');
  });

  it("allows export to be explicitly disabled", () => {
    expect(render('::h5p{src="/test.h5p" export="false"}')).not.toContain(
      "data-export",
    );
  });

  it("allows a custom download URL", () => {
    const html = render(
      '::h5p{src="/test.h5p" export download-url="https://example.com/original.h5p"}',
    );

    expect(html).toContain(
      'data-download-url="https://example.com/original.h5p"',
    );
  });
});
