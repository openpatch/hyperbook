import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkPageProtect from "../src/remarkPageProtect";
import remarkDirectiveProtect from "../src/remarkDirectiveProtect";
import rehypeProtect from "../src/rehypeProtect";
import remarkParse from "../src/remarkParse";
import { decryptHtml } from "../src/protect";
import { ctx as baseCtx } from "./mock";
import { i18n } from "../src/i18n";

i18n.init("en");

const makeCtx = (
  current: Record<string, unknown> | null,
  { basePath = "" }: { basePath?: string } = {},
): HyperbookContext =>
  ({
    ...baseCtx,
    config: { ...baseCtx.config, protect: { iterations: 1000 } },
    navigation: { ...baseCtx.navigation, current },
    // Mirrors the real makeUrl closely enough for id generation.
    makeUrl: (p: string | string[]) =>
      basePath + (Array.isArray(p) ? p.join("/") : p),
    passwords: {
      "chapter-3": { value: "kepler" },
      "deep-key": { value: "galilei" },
    },
  }) as unknown as HyperbookContext;

const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkPageProtect(ctx),
    remarkDirectiveProtect(ctx),
  ];
  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeProtect(ctx))
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .process(md);
};

const html = async (md: string, ctx: HyperbookContext) =>
  String((await toHtml(md, ctx)).value);

const idOf = (out: string) =>
  out.match(/directive-protect" data-id="([^"]+)"/)?.[1];

const payloadOf = (out: string) =>
  JSON.parse(
    out.match(
      /class="protect-payload">([\s\S]*?)<\/script>/,
    )![1],
  );

describe("remarkPageProtect", () => {
  const page = "# Title\n\nthe page secret\n";

  it("leaves an unprotected page alone", async () => {
    const out = await html(page, makeCtx({ name: "Home", href: "/" }));
    expect(out).toContain("the page secret");
    expect(out).not.toContain("directive-protect");
  });

  it("encrypts the whole page, headings included", async () => {
    const out = await html(
      page,
      makeCtx({ name: "Solutions", href: "/solutions", protect: "chapter-3" }),
    );
    expect(out).not.toContain("the page secret");
    expect(out).not.toContain("Title");
    expect(out).not.toContain("kepler");
    expect(decryptHtml(payloadOf(out), "kepler")).toContain("the page secret");
  });

  it("accepts the object form with an inline password", async () => {
    const out = await html(
      page,
      makeCtx({
        name: "Solutions",
        href: "/solutions",
        protect: { password: "literal", description: "Ask your teacher" },
      }),
    );
    expect(out).toContain("Ask your teacher");
    expect(decryptHtml(payloadOf(out), "literal")).toContain("the page secret");
  });

  it("scopes the unlock id to the basePath", async () => {
    // The books of a hyperlibrary share one origin and therefore one store.
    // Without the basePath, two translations of the same page would land on
    // the same id and unlock each other.
    const en = await html(
      page,
      makeCtx({ name: "Solutions", href: "/solutions", protect: "chapter-3" }),
    );
    const de = await html(
      page,
      makeCtx(
        { name: "Lösungen", href: "/solutions", protect: "chapter-3" },
        { basePath: "/de" },
      ),
    );

    expect(idOf(en)).toBe("page:/solutions");
    expect(idOf(de)).toBe("page:/de/solutions");
    expect(idOf(en)).not.toBe(idOf(de));
  });

  it("shares one unlock across a protected section", async () => {
    // Every page that inherited from the same section carries that section's
    // protectSource, so they land in one unlock group: entering the password
    // once opens the section instead of every page asking again.
    const section = await html(
      page,
      makeCtx({
        name: "Solutions",
        href: "/solutions",
        protect: "chapter-3",
        protectSource: "/solutions",
      }),
    );
    const inherited = await html(
      page,
      makeCtx({
        name: "One",
        href: "/solutions/one",
        protect: "chapter-3",
        protectInherited: true,
        protectSource: "/solutions",
      }),
    );
    const nested = await html(
      page,
      makeCtx({
        name: "Three",
        href: "/solutions/deep/three",
        protect: "chapter-3",
        protectInherited: true,
        protectSource: "/solutions",
      }),
    );

    expect(idOf(section)).toBe("page:/solutions");
    expect(idOf(inherited)).toBe("page:/solutions");
    expect(idOf(nested)).toBe("page:/solutions");
  });

  it("keeps an overriding subsection on its own unlock", async () => {
    const outer = await html(
      page,
      makeCtx({
        name: "Solutions",
        href: "/solutions",
        protect: "chapter-3",
        protectSource: "/solutions",
      }),
    );
    const inner = await html(
      page,
      makeCtx({
        name: "Two",
        href: "/solutions/deep/two",
        protect: "deep-key",
        protectInherited: true,
        protectSource: "/solutions/deep",
      }),
    );

    expect(idOf(outer)).not.toBe(idOf(inner));
    expect(idOf(inner)).toBe("page:/solutions/deep");
  });

  it("keeps the id stable across builds", async () => {
    const ctx = makeCtx({
      name: "Solutions",
      href: "/solutions",
      protect: "chapter-3",
    });
    // Ciphertext changes every build, but a reader who unlocked the page must
    // stay unlocked, so the id may not.
    const first = await html(page, ctx);
    const second = await html(page, ctx);
    expect(idOf(first)).toBe(idOf(second));
    expect(payloadOf(first).ct).not.toBe(payloadOf(second).ct);
  });

  it("does nothing on an empty page", async () => {
    const out = await html(
      "",
      makeCtx({ name: "Empty", href: "/empty", protect: "chapter-3" }),
    );
    expect(out).not.toContain("directive-protect");
  });
});
