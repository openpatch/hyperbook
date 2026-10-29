import { HyperbookContext, isExternalUrl } from "@hyperbook/types";
import path from "path";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkToRehype from "remark-rehype";
import { PluggableList, unified } from "unified";
import { describe, expect, it } from "vitest";
import remarkDirectiveEmbed from "../src/remarkDirectiveEmbed";
import remarkDirectiveKirimoto from "../src/remarkDirectiveKirimoto";
import remarkDirectiveTiles from "../src/remarkDirectiveTiles";
import remarkParse from "../src/remarkParse";
import { ctx as mock } from "./mock";

/**
 * Directive paths that the page loads resolve like its links: relative ones
 * from the page's folder, here sub/. makeUrl resolves them as build.ts does.
 */
const ctx: HyperbookContext = {
  ...mock,
  navigation: {
    ...mock.navigation,
    current: { ...mock.navigation.current!, path: { directory: "sub" } as any },
  },
  makeUrl: (p, _base, page) => {
    const url = typeof p === "string" ? p : p.join("/");
    if (isExternalUrl(url)) return url;
    if (url.startsWith("/") || !page) return url;
    return path.posix.resolve("/", page.path?.directory || "", url);
  },
};

const toHtml = (md: string) => {
  const plugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveEmbed(ctx),
    remarkDirectiveKirimoto(ctx),
    remarkDirectiveTiles(ctx),
  ];
  return String(
    unified()
      .use(remarkParse)
      .use(plugins)
      .use(remarkToRehype)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .processSync(md),
  );
};

describe("relative paths in directives", () => {
  it("resolve a Kiri:Moto model from the page's folder", () => {
    expect(toHtml(`::kirimoto{model="./cube.stl"}`)).toContain(
      'data-model="/sub/cube.stl"',
    );
  });

  it("resolve an embedded file, and leave other sites alone", () => {
    expect(toHtml(`::embed{src="../demo.html" consent="false"}`)).toContain(
      'src="/demo.html"',
    );
    expect(
      toHtml(`::embed{src="https://example.org/x" consent="false"}`),
    ).toContain('src="https://example.org/x"');
  });

  it("resolve a tile's icon", () => {
    expect(
      toHtml(`::::tiles\n:::tile{title="A" icon="icons/a.svg"}\n:::\n::::`),
    ).toContain('src="/sub/icons/a.svg"');
  });
});
