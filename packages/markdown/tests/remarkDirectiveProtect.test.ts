import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveProtect from "../src/remarkDirectiveProtect";
import rehypeProtect from "../src/rehypeProtect";
import remarkParse from "../src/remarkParse";
import { decryptHtml, ProtectPayload } from "../src/protect";
import { i18n } from "../src/i18n";

// The real pipeline initializes this in remark(); this test builds its own.
i18n.init("en");

const withProtect = (c: HyperbookContext, mode?: "encrypt" | "obfuscate") =>
  ({
    ...c,
    config: {
      ...c.config,
      // Low work factor keeps the suite fast; the scheme is unchanged.
      protect: { mode, iterations: 1000 },
    },
  }) as HyperbookContext;

// remarkDirectiveProtect is async, so the pipeline cannot be run with
// processSync.
const toHtml = (md: string, c: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveProtect(c),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeProtect(c))
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .process(md);
};

const html = async (md: string, c: HyperbookContext) =>
  String((await toHtml(md, c)).value);

const payloadsOf = (html: string): ProtectPayload[] =>
  [
    ...html.matchAll(
      /<script type="application\/json" class="protect-payload">([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => JSON.parse(m[1]));

/**
 * Salt and iv are random per build, so the ciphertext differs on every run.
 * Blank it out to keep the markup snapshottable.
 */
const stableCiphertext = (html: string) =>
  html.replace(
    /(class="protect-payload">)[\s\S]*?(<\/script>)/g,
    "$1<payload>$2",
  );

describe("remarkDirectiveProtect", () => {
  const encryptCtx = withProtect(ctx, "encrypt");

  it("should register the directive", async () => {
    expect(
      (await toHtml(`:::protect{password="pw"}\n\nhi\n\n:::`, encryptCtx)).data
        .directives?.["protect"],
    ).toBeDefined();
  });

  it("should transform", async () => {
    expect(
      stableCiphertext(
        await html(
          `:::protect{password="hyperbook" description="A hint"}\n\nsecret content\n\n:::`,
          encryptCtx,
        ),
      ),
    ).toMatchSnapshot();
  });

  it("should not emit the plaintext or the password", async () => {
    const out = await html(
      `:::protect{password="hyperbook"}\n\nthe secret content\n\n:::`,
      encryptCtx,
    );
    expect(out).not.toContain("the secret content");
    expect(out).not.toContain("hyperbook");
    expect(out).not.toContain(Buffer.from("hyperbook").toString("base64"));
    expect(out).not.toContain("data-toast");
    // The instance id is only a transport key for the build; it must not leak
    // into the page either, or it would identify blocks across rebuilds.
    expect(out).not.toContain("data-instance");
  });

  it("should encrypt content that can be decrypted with the password", async () => {
    const out = await html(
      `:::protect{password="hyperbook"}\n\nthe secret content\n\n:::`,
      encryptCtx,
    );
    const [payload] = payloadsOf(out);
    expect(decryptHtml(payload, "hyperbook")).toContain("the secret content");
  });

  it("should keep the group id and share it across blocks", async () => {
    const out = await html(
      `:::protect{id="shared" password="pw"}\n\none\n\n:::\n\n:::protect{id="shared" password="pw"}\n\ntwo\n\n:::`,
      encryptCtx,
    );
    expect([...out.matchAll(/data-id="shared"/g)]).toHaveLength(4);

    // Same group, same password, different content: the ciphertexts must not
    // share a salt or iv, or one would leak the other.
    const [a, b] = payloadsOf(out);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(decryptHtml(a, "pw")).toContain("one");
    expect(decryptHtml(b, "pw")).toContain("two");
  });

  it("should encrypt nested blocks innermost first", async () => {
    const out = await html(
      `::::protect{password="outer"}\n\nouter content\n\n:::protect{password="inner"}\n\ninner content\n\n:::\n\n::::`,
      encryptCtx,
    );

    // Only the outer block is visible; the inner one is inside its ciphertext.
    const payloads = payloadsOf(out);
    expect(payloads).toHaveLength(1);

    const outer = decryptHtml(payloads[0], "outer");
    expect(outer).toContain("outer content");
    expect(outer).not.toContain("inner content");

    const [innerPayload] = payloadsOf(outer);
    expect(decryptHtml(innerPayload, "inner")).toContain("inner content");
  });

  it("should reproduce the legacy markup in obfuscate mode", async () => {
    const out = await html(
      `:::protect{password="hyperbook"}\n\nsecret content\n\n:::`,
      withProtect(ctx, "obfuscate"),
    );
    expect(out).toContain(
      `data-toast="${Buffer.from("hyperbook").toString("base64")}"`,
    );
    expect(out).toContain("secret content");
    expect(out).not.toContain("protect-payload");
  });
});
