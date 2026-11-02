import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveJavaide from "../src/remarkDirectiveJavaide";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveJavaide(ctx),
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

const workspaceOf = (html: string) => {
  const encoded = html.match(/data-workspace="([^"]*)"/)?.[1];
  expect(encoded).toBeDefined();
  const bytes = Uint8Array.from(atob(encoded!), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

describe("remarkDirectiveJavaide", () => {
  it("should transform basic javaide", async () => {
    expect(
      toHtml(
        `:::javaide

\`\`\`java
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello World");
  }
}
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform javaide with a test file", async () => {
    expect(
      toHtml(
        `:::javaide

\`\`\`java
System.out.println("Hello")
\`\`\`

\`\`\`java file="TestMain.java" role="test" hidden
if (1 + 1 != 2) throw new AssertionError();
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("makes the unnamed java block the main file", () => {
    const html = String(
      toHtml(
        `:::javaide
\`\`\`java
System.out.println("hi");
\`\`\`
:::
`,
        ctx,
      ).value,
    );
    expect(workspaceOf(html)).toEqual({
      main: "Main.java",
      files: [{ path: "Main.java", content: 'System.out.println("hi");' }],
    });
    // JavaIDE loads CheerpJ from its CDN by default, like PyIDE loads Pyodide.
    expect(html).toContain(
      'data-runtime-url="https://cjrtnc.leaningtech.com/5.0/"',
    );
    expect(html).toContain('data-accept=".java"');
  });

  it("collects named files, flags and the main attribute", () => {
    const workspace = workspaceOf(
      String(
        toHtml(
          `:::javaide{main="App.java"}
\`\`\`java file="App.java"
Helper.greet();
\`\`\`
\`\`\`java file="Helper.java" readonly
class Helper { static void greet() {} }
\`\`\`
:::
`,
          ctx,
        ).value,
      ),
    );
    expect(workspace).toEqual({
      main: "App.java",
      files: [
        { path: "App.java", content: "Helper.greet();" },
        {
          path: "Helper.java",
          content: "class Helper { static void greet() {} }",
          readonly: true,
        },
      ],
    });
  });

  it("warns when the runtime is configured to be local", () => {
    const localCtx: HyperbookContext = {
      ...ctx,
      config: { ...ctx.config, elements: { javaide: { cdn: false } } },
    };
    const file = toHtml(`:::javaide\n\`\`\`java\n\`\`\`\n:::\n`, localCtx);
    const html = String(file.value);
    expect(html).not.toContain("data-runtime-url");
    expect(
      file.messages.some((m) => m.message.includes("elements.javaide.cdn")),
    ).toBe(true);
  });
});
