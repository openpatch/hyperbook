import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveBitflow from "../src/remarkDirectiveBitflow";
import remarkParse from "../src/remarkParse";
import { i18n } from "../src/i18n";

i18n.init("en");

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveBitflow(ctx),
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

describe("remarkDirectiveBitflow", () => {
  it("should transform", async () => {
    expect(
      toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx).value,
    ).toMatchSnapshot();
  });

  it("should register directives", async () => {
    const result = toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx);
    const directive = result.data.directives?.["bitflow"];
    expect(directive).toBeDefined();
    expect(directive?.scripts).toContain("client.js");
    expect(directive?.styles).toContain("style.css");
  });

  // The bundle imports a chunk per bit type by relative specifier. Served as a
  // classic script those imports are a syntax error, and nothing renders.
  it("should load the bundle as a module", async () => {
    const result = toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx);
    expect(result.data.directives?.["bitflow"].scripts).toContainEqual({
      type: "module",
      src: "flow.js",
      position: "head",
    });
  });

  // The editor and the report views live behind the package's other entries.
  // A book is the reading half, and `index.js` would pull the canvas in too.
  it("should not load the editor", async () => {
    const result = toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx);
    const scripts = JSON.stringify(result.data.directives?.["bitflow"].scripts);
    expect(scripts).not.toContain("editor.js");
    expect(scripts).not.toContain("index.js");
  });

  it("should inline the flow read from src", async () => {
    const html = String(
      toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx).value,
    );
    expect(html).toContain("<bitflow-flow");
    expect(html).toContain("Is Paris the capital of France?");
  });

  it("should use the given height", async () => {
    expect(
      String(
        toHtml(`\n::bitflow{#quiz src="quiz.json" height="400px"}\n`, ctx)
          .value,
      ),
    ).toContain("height: 400px");
  });

  it("should default the locale to the book's language", async () => {
    expect(
      String(toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx).value),
    ).toContain(`locale="${ctx.config.language || "en"}"`);
  });

  it("should let a flow override the locale", async () => {
    expect(
      String(
        toHtml(`\n::bitflow{#quiz src="quiz.json" locale="de"}\n`, ctx).value,
      ),
    ).toContain('locale="de"');
  });

  it("should not be readonly by default", async () => {
    expect(
      String(toHtml(`\n::bitflow{#quiz src="quiz.json"}\n`, ctx).value),
    ).not.toContain("readonly");
  });

  it("should mark a readonly flow readonly", async () => {
    expect(
      String(
        toHtml(`\n::bitflow{#quiz src="quiz.json" readonly}\n`, ctx).value,
      ),
    ).toContain('readonly="true"');
  });

  it("should report a missing src", async () => {
    const result = toHtml(`\n::bitflow{#quiz}\n`, ctx);
    expect(result.messages.map((m) => String(m.reason))).toEqual([
      `Missing "src" attribute`,
    ]);
  });

  it("should report a file that does not exist", async () => {
    const result = toHtml(`\n::bitflow{#quiz src="nope.json"}\n`, ctx);
    expect(result.messages.map((m) => String(m.reason))).toEqual([
      "File not found: nope.json",
    ]);
  });

  it("should report a file it cannot parse", async () => {
    const result = toHtml(`\n::bitflow{#quiz src="broken.bitflow"}\n`, ctx);
    expect(result.messages).toHaveLength(1);
    expect(String(result.messages[0].reason)).toContain(
      "Could not parse broken.bitflow",
    );
  });
});
