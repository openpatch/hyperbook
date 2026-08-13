import fsp from "fs/promises";
import os from "os";
import path from "path";
import { HyperbookContext } from "@hyperbook/types/dist";
import { hyperbook } from "@hyperbook/fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectivePasswordlist from "../src/remarkDirectivePasswordlist";
import remarkParse from "../src/remarkParse";
import { clearCollectedPasswords } from "../src/collectPasswords";
import { ctx as baseCtx } from "./mock";
import { i18n } from "../src/i18n";

i18n.init("en");

/**
 * The directive reads the book from disk, so each case gets a real one. Small
 * enough to stay fast, and it exercises the same collector the CLI uses.
 */
describe("remarkDirectivePasswordlist", () => {
  let root: string;

  const write = async (relative: string, content: string) => {
    const target = path.join(root, relative);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content);
  };

  const makeCtx = async (currentHref?: string): Promise<HyperbookContext> => {
    const pagesAndSections = await hyperbook.getPagesAndSections(root);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    return {
      ...baseCtx,
      root,
      navigation: {
        ...pagesAndSections,
        next: null,
        previous: null,
        current: pageList.find((p) => p.href === currentHref) || null,
      },
    } as HyperbookContext;
  };

  const toHtml = (md: string, ctx: HyperbookContext) => {
    const remarkPlugins: PluggableList = [
      remarkDirective,
      remarkDirectiveRehype,
      remarkDirectivePasswordlist(ctx),
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
      .process(md);
  };

  const html = async (md: string, ctx: HyperbookContext) =>
    String((await toHtml(md, ctx)).value);

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "hyperbook-pwlist-"));
    clearCollectedPasswords();

    await write("hyperbook.json", JSON.stringify({ name: "Book" }));
    await write(
      "passwords.json",
      JSON.stringify({
        passwords: {
          ch1: { value: "alpha", description: "Chapter 1 answers" },
          ch2: { value: "beta", description: "Chapter 2 answers" },
          orphan: { value: "unused-value" },
        },
      }),
    );
    await write("book/index.md", "---\nname: Home\n---\n\n# Home\n");
    await write(
      "book/chapter1/index.md",
      '---\nname: Chapter 1\n---\n\n# One\n\n:::protect{use="ch1"}\n\nsecret\n\n:::\n',
    );
    await write(
      "book/chapter1/extra.md",
      "---\nname: Extra\nprotect: ch1\n---\n\n# Extra\n",
    );
    await write(
      "book/chapter2/index.md",
      '---\nname: Chapter 2\n---\n\n# Two\n\n:::protect{use="ch2"}\n\nsecret\n\n:::\n',
    );
  });

  afterEach(async () => {
    clearCollectedPasswords();
    await fsp.rm(root, { recursive: true, force: true });
  });

  it("should register the directive", async () => {
    const ctx = await makeCtx("/");
    expect(
      (await toHtml("::passwordlist", ctx)).data.directives?.["passwordlist"],
    ).toBeDefined();
  });

  it("lists every password by default", async () => {
    const out = await html("::passwordlist", await makeCtx("/"));
    expect(out).toContain("alpha");
    expect(out).toContain("beta");
    expect(out).toContain("unused-value");
  });

  it("filters by type", async () => {
    const out = await html(
      '::passwordlist{type="registry"}',
      await makeCtx("/"),
    );
    // Three registry entries, and nothing from pages or blocks.
    expect([...out.matchAll(/class="password"/g)]).toHaveLength(3);
    expect(out).not.toContain("chapter1/index.md");
  });

  it("filters by a href pattern", async () => {
    const out = await html(
      '::passwordlist{source="href(/chapter1.*)"}',
      await makeCtx("/"),
    );
    expect(out).toContain("alpha");
    expect(out).not.toContain("beta");
  });

  it("scopes to the current section", async () => {
    const out = await html(
      '::passwordlist{scope="section"}',
      await makeCtx("/chapter2"),
    );
    expect(out).toContain("beta");
    expect(out).not.toContain("alpha");
  });

  it("scopes to the current page", async () => {
    const out = await html(
      '::passwordlist{scope="page"}',
      await makeCtx("/chapter1/extra"),
    );
    expect(out).toContain("alpha");
    expect(out).not.toContain("beta");
    expect([...out.matchAll(/class="password"/g)]).toHaveLength(1);
  });

  it("renders a list format", async () => {
    const out = await html(
      '::passwordlist{format="ul" type="registry"}',
      await makeCtx("/"),
    );
    expect(out).toContain("<ul>");
    expect(out).toContain("Chapter 1 answers");
  });

  it("honours limit", async () => {
    const out = await html(
      '::passwordlist{type="registry" limit="1"}',
      await makeCtx("/"),
    );
    expect([...out.matchAll(/class="password"/g)]).toHaveLength(1);
  });

  it("says so when nothing matches", async () => {
    const out = await html(
      '::passwordlist{source="href(/nowhere.*)"}',
      await makeCtx("/"),
    );
    expect(out).toContain("No passwords.");
  });

  it("does not wrap passwords in <code>", async () => {
    // rehypePrettyCode turns every code element into a highlighted figure with
    // a copy button and an injected stylesheet, which is not wanted here.
    const out = await html("::passwordlist", await makeCtx("/"));
    expect(out).not.toContain("<code");
  });
});
