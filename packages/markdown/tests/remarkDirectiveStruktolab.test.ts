import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveStruktolab from "../src/remarkDirectiveStruktolab";
import remarkParse from "../src/remarkParse";

const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveStruktolab(ctx),
  ];
  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(md);
};

describe("remarkDirectiveStruktolab", () => {
  it("passes pseudocode as before", () => {
    const html = String(toHtml(":::struktolab\n```\nausgabe(1)\n```\n:::", ctx).value);
    expect(html).toContain('<script type="text/pseudocode">ausgabe(1)</script>');
    expect(html).not.toContain("code-mode");
  });

  it("reads the code language from the fence", () => {
    const html = String(
      toHtml(':::struktolab{mode="edit"}\n```java\nvoid main() {\n}\n```\n:::', ctx).value,
    );
    expect(html).toContain("<struktolab-editor");
    expect(html).toContain('code-mode="java"');
    expect(html).toContain('<script type="text/plain" data-code="java">');
  });

  it("maps short fence names", () => {
    const html = String(toHtml(":::struktolab\n```py\nprint(1)\n```\n:::", ctx).value);
    expect(html).toContain('data-code="python"');
    expect(html).toContain('code-mode="python"');
  });

  it("takes the language from `code` for a bare fence", () => {
    const html = String(toHtml(':::struktolab{code="javascript"}\n```\nconsole.log(1)\n```\n:::', ctx).value);
    expect(html).toContain('data-code="javascript"');
    expect(html).toContain('code-mode="javascript"');
  });

  it("can hide the code under the editor", () => {
    const html = String(toHtml(':::struktolab{mode="edit" code="none"}\n```\nausgabe(1)\n```\n:::', ctx).value);
    expect(html).toContain('code-mode="none"');
    expect(html).toContain('<script type="text/pseudocode">');
  });

  it("ignores a code language it does not know", () => {
    const html = String(toHtml(':::struktolab{code="cobol"}\n```\nausgabe(1)\n```\n:::', ctx).value);
    expect(html).not.toContain("code-mode");
  });

  it("starts an empty structogram in a language", () => {
    const html = String(toHtml('::struktolab{mode="edit" code="java"}', ctx).value);
    expect(html).toContain("<struktolab-editor");
    expect(html).toContain('code-mode="java"');
  });
});
