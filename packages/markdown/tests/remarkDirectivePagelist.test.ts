import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { realCtx } from "./mock";
import remarkDirectivePagelist from "../src/remarkDirectivePagelist";
import remarkDirectiveTiles from "../src/remarkDirectiveTiles";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectivePagelist(ctx),
    remarkDirectiveTiles(ctx),
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

describe("remarkDirectiveEmbed", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/*)"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should sort by name asc", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/*)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter by name", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="name(.*IDE.*)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should sort by name desc", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/.*)" orderBy="name:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter glossary", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/glossary/.*)" orderBy="name:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter glossary and format as glossary", async () => {
    expect(
      toHtml(
        `
::pagelist{format="glossary" source="href(/glossary/.*)"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter by keyword", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="keyword(test)" orderBy="name:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter by two keywords", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="keyword(test) AND keyword(ball)" orderBy="name:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should filter by one keyword and a href", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="keyword(test) AND href(/elements/.*)" orderBy="name:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should format as ul", async () => {
    expect(
      toHtml(
        `
::pagelist{format="ul"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should format as ol", async () => {
    expect(
      toHtml(
        `
::pagelist{format="ol"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/*)"}
`,
        realCtx,
      ).data.directives?.["pagelist"],
    ).toBeDefined();
  });
  it("should transform directive in snippet", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#portal" source="href(/elements/.*)" orderBy="index"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  // OR operator tests
  it("should filter with OR operator", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="name(Video) OR name(Audio)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should filter with multiple OR conditions", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="name(Video) OR name(Audio) OR name(Embed)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  // NOT operator tests
  it("should filter with NOT operator", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/.*) AND NOT name(Video)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should filter with standalone NOT", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="NOT keyword(test)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  // Parentheses for grouping
  it("should support parentheses for grouping", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="href(/elements/.*) AND (name(Video) OR name(Audio))" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should support complex nested expressions", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="(href(/elements/.*) OR href(/advanced/.*)) AND keyword(test)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  // Custom frontmatter tests
  it("should filter by custom frontmatter field", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="difficulty(beginner)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should filter by custom frontmatter array field", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="tags(media)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should combine custom frontmatter with standard fields", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="difficulty(intermediate) AND keyword(test)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should filter by custom frontmatter with OR", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="difficulty(beginner) OR difficulty(intermediate)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should filter by custom frontmatter with NOT", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="tags(media) AND NOT difficulty(beginner)" orderBy="name:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  // Custom frontmatter orderBy tests
  it("should order by custom frontmatter field asc", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="tags(media)" orderBy="difficulty:asc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should order by custom frontmatter field desc", async () => {
    expect(
      toHtml(
        `
::pagelist{format="#list" source="tags(media)" orderBy="difficulty:desc"}
`,
        realCtx,
      ).value,
    ).toMatchSnapshot();
  });
});
