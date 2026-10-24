import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectivePyide from "../src/remarkDirectivePyide";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectivePyide(ctx),
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

describe("remarkDirectivePyide", () => {
  it("should transform basic pyide", async () => {
    expect(
      toHtml(
        `:::pyide

\`\`\`python
print("Hello World")
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with canvas attribute", async () => {
    expect(
      toHtml(
        `:::pyide{canvas}

\`\`\`python
import pygame
pygame.init()
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with packages attribute", async () => {
    expect(
      toHtml(
        `:::pyide{packages="snowballstemmer, nltk"}

\`\`\`python
import snowballstemmer
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform pyide with canvas and packages attributes", async () => {
    expect(
      toHtml(
        `:::pyide{canvas packages="snowballstemmer"}

\`\`\`python
import snowballstemmer
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("leaves out pytamaro, which cannot be installed for now", async () => {
    const html = toHtml(
      `:::pyide{packages="pytamaro, numpy"}

\`\`\`python
from pytamaro import *
\`\`\`

:::

`,
      ctx,
    ).value;
    expect(html).toContain('data-packages="numpy"');
    expect(html).not.toMatch(/data-packages="[^"]*pytamaro/);
  });

  it("should survive a round trip through data-workspace with non-ASCII code", async () => {
    // The workspace is stored base64-encoded in data-workspace and decoded
    // again by ide-bundle/workspace.js. Buffer.from() encodes UTF-8 *bytes*,
    // so the client has to decode them as UTF-8 -- a bare atob() hands back one
    // character per byte and mangles every assertion message a learner reads.
    const testCode = 'assert groesse > 0, "Die Größe muss größer als 0 sein"';

    const html = String(
      toHtml(
        `:::pyide

\`\`\`python
groesse = 20
\`\`\`

\`\`\`python file="test_1.py" role="test" hidden
${testCode}
\`\`\`

:::
`,
        ctx,
      ).value,
    );

    const workspace = workspaceOf(html);
    expect(workspace.files[1]).toEqual({
      path: "test_1.py",
      content: testCode,
      hidden: true,
      role: "test",
    });

    // and why it has to: the shortcut mangles every non-ASCII character
    const encoded = html.match(/data-workspace="([^"]*)"/)![1];
    expect(atob(encoded)).toContain("GrÃ¶Ã\u009fe");
  });

  it("makes the unnamed python block the main file", () => {
    const workspace = workspaceOf(
      String(
        toHtml(
          `:::pyide
\`\`\`python
print("hi")
\`\`\`
:::
`,
          ctx,
        ).value,
      ),
    );
    expect(workspace).toEqual({
      main: "main.py",
      files: [{ path: "main.py", content: 'print("hi")' }],
    });
  });

  it("collects named files, flags and the main attribute", () => {
    const workspace = workspaceOf(
      String(
        toHtml(
          `:::pyide{main="app.py"}
\`\`\`python file="app.py"
from helpers import greet
greet()
\`\`\`
\`\`\`python file="helpers.py" readonly
def greet(): print("hi")
\`\`\`
:::
`,
          ctx,
        ).value,
      ),
    );
    expect(workspace).toEqual({
      main: "app.py",
      files: [
        { path: "app.py", content: "from helpers import greet\ngreet()" },
        {
          path: "helpers.py",
          content: 'def greet(): print("hi")',
          readonly: true,
        },
      ],
    });
  });

  it("reads ::file sources as text or links them as binary", () => {
    const workspace = workspaceOf(
      String(
        toHtml(
          `:::pyide
::file{path="main.py" src="pyide-main.py"}
::file{path="img/logo.png" src="/logo.png"}
:::
`,
          ctx,
        ).value,
      ),
    );
    expect(workspace.files).toEqual([
      { path: "main.py", content: 'print("from a file")\n' },
      { path: "img/logo.png", url: "/public/logo.png" },
    ]);
  });

  it("shows the test button only when there are test files", () => {
    const withTest = String(
      toHtml(
        `:::pyide
\`\`\`python
x = 1
\`\`\`
\`\`\`python file="test_1.py" role="test"
#SCRIPT#
assert x == 1
\`\`\`
:::
`,
        ctx,
      ).value,
    );
    expect(withTest).toContain('class="test"');
    const without = String(
      toHtml(
        `:::pyide
\`\`\`python
x = 1
\`\`\`
:::
`,
        ctx,
      ).value,
    );
    expect(without).not.toContain('class="test"');
  });

  it.each([
    ["", undefined],
    ['{files="open"}', "create,upload,rename,delete"],
    ['{files="upload, delete"}', "upload,delete"],
    ['{files="none"}', undefined],
  ])("turns %s into the file actions the shell offers", (attrs: string, actions: string | undefined) => {
    const html = String(
      toHtml(`:::pyide${attrs}\n\`\`\`python\nx = 1\n\`\`\`\n:::\n`, ctx).value,
    );
    if (actions) expect(html).toContain(`data-files="${actions}"`);
    else expect(html).not.toContain("data-files=");
    expect(html).toContain('data-accept=".py"');
  });

  it("warns about file actions it does not know", () => {
    const file = toHtml(`::pyide{files="share"}\n`, ctx);
    expect(file.messages.map((m) => m.reason).join("\n")).toContain(
      'files="share"',
    );
  });

  it("points authors of the old syntax to hyperbook migrate", () => {
    const file = toHtml(
      `:::pyide
\`\`\`python
x = 1
\`\`\`
\`\`\`python test
assert x == 1
\`\`\`
:::
`,
      ctx,
    );
    expect(file.messages.map((m) => m.reason).join("\n")).toContain(
      "hyperbook migrate",
    );
    // The old test block is not silently turned into a file.
    expect(workspaceOf(String(file.value)).files).toHaveLength(1);
  });

  it("warns about the removed src attribute", () => {
    const file = toHtml(`::pyide{src="pyide-main.py"}\n`, ctx);
    expect(file.messages.map((m) => m.reason).join("\n")).toContain("::file");
  });
});

/** The workspace the page hands the client, decoded like the client does. */
const workspaceOf = (html: string) => {
  const encoded = html.match(/data-workspace="([^"]*)"/)?.[1];
  expect(encoded).toBeDefined();
  const bytes = Uint8Array.from(atob(encoded!), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
