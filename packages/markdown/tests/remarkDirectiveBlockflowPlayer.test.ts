import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveBlockflowPlayer from "../src/remarkDirectiveBlockflowPlayer";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveBlockflowPlayer(ctx),
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

describe("remarkDirectiveBlockflowPlayer", () => {
  it("should request an unversioned asset URL without page-relative paths", () => {
    const result = toHtml('::blockflow-player{src="./test.sb3"}', {
      ...ctx,
      makeUrl: (p, base, page, options) => {
        if (base === "assets") {
          expect(page).toBeUndefined();
          expect(options?.versioned).toBe(false);
        }
        return ctx.makeUrl(p, base, page, options);
      },
    });
    expect(result.value).toContain("player.html?project=");
  });

  it("should embed the shared local bundle and register its assets", () => {
    const result = toHtml('::blockflow-player{src="./test.sb3"}', ctx);
    expect(result.value).toContain(
      "/assets/directive-blockflow/player.html?project=%2Fpublic%2Ftest.sb3",
    );
    expect(result.value).not.toContain("blockflow.openpatch.org");
    expect(result.data.directives?.blockflow).toBeDefined();
  });

  it("should respect the book base path for bundle URLs", () => {
    const result = toHtml('::blockflow-player{src="./test.sb3"}', {
      ...ctx,
      makeUrl: (p, base, page) =>
        base === "assets"
          ? `/course/__hyperbook_assets/${Array.isArray(p) ? p.join("/") : p}`
          : ctx.makeUrl(p, base, page),
    });
    expect(result.value).toContain(
      "/course/__hyperbook_assets/directive-blockflow/player.html?project=",
    );
  });

  it("should transform", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should support custom dimensions", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3" width="800px" height="500px"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::blockflow-player{src="https://example.com/project.sb3"}
`,
        ctx,
      ).data.directives?.["blockflow-player"],
    ).toBeDefined();
  });
});
