import { describe, expect, it } from "vitest";
import { process } from "../src/process";
import { ctx } from "./mock";
// @ts-expect-error The browser client is JavaScript.
import { buildPage } from "../assets/directive-webide/src/page.js";
// @ts-expect-error The browser client is JavaScript.
import { buildSketchPage, wrapSketch } from "../assets/directive-p5/src/page.js";

/** The workspace a directive hands its client. */
const workspaceOf = async (md: string, cls: string) => {
  const html = String((await process(md, ctx)).value);
  // Up to the workspace attribute; p5's template attribute holds raw markup.
  const element = html.match(
    new RegExp(`<div class="${cls}[^"]*"[\\s\\S]*?data-workspace="([^"]*)"`),
  );
  expect(element).toBeDefined();
  const encoded = element![1];
  return {
    html,
    element: element![0],
    workspace: JSON.parse(Buffer.from(encoded, "base64").toString("utf8")),
  };
};

describe("webide", () => {
  it("makes the unnamed html block index.html", async () => {
    const { workspace } = await workspaceOf(
      `:::webide

\`\`\`html
<h1>Hi</h1>
\`\`\`

\`\`\`css file="style.css"
h1 { color: red; }
\`\`\`

:::
`,
      "directive-webide",
    );
    expect(workspace).toEqual({
      main: "index.html",
      files: [
        { path: "index.html", content: "<h1>Hi</h1>" },
        { path: "style.css", content: "h1 { color: red; }" },
      ],
    });
  });

  it("points the page's links at the files' blob URLs", () => {
    let n = 0;
    const { html, urls } = buildPage(
      [
        {
          path: "index.html",
          content:
            '<link href="style.css" rel="stylesheet"><script src="./app.js"></script><a href="other.html">x</a><img src=\'logo.png\'>',
        },
        { path: "style.css", content: "h1{}" },
        { path: "app.js", content: "1" },
        { path: "logo.png", url: "data:image/png;base64,AA==" },
      ],
      "index.html",
      () => `blob:${++n}`,
    );
    expect(html).toBe(
      '<link href="blob:1" rel="stylesheet"><script src="blob:2"></script><a href="other.html">x</a><img src=\'data:image/png;base64,AA==\'>',
    );
    expect(urls).toEqual(["blob:1", "blob:2"]);
  });
});

describe("p5", () => {
  it("shows only the sketch without mode=editor", async () => {
    const { html, element, workspace } = await workspaceOf(
      `:::p5

\`\`\`js
circle(50, 50, 20);
\`\`\`

:::
`,
      "directive-p5",
    );
    expect(element).toContain('class="directive-p5 standalone"');
    expect(html).not.toContain('class="editor"');
    expect(workspace.files).toEqual([
      { path: "sketch.js", content: "circle(50, 50, 20);" },
    ]);
  });

  it("loads helper files before the sketch", () => {
    const page = buildSketchPage(
      "<head></head>###SCRIPTS###",
      [
        { path: "sketch.js", content: "function setup() { helper(); }" },
        { path: "helper.js", content: 'function helper() { "</script>"; }' },
      ],
      "sketch.js",
    );
    expect(page).toBe(
      '<head></head><script type="text/javascript">function helper() { "<\\/script>"; }</script>\n' +
        '<script type="text/javascript">function setup() { helper(); }</script>',
    );
  });

  it("gives drawing commands without setup() a canvas", () => {
    expect(wrapSketch("circle(1, 1, 1);")).toContain("function setup()");
    expect(wrapSketch("function setup() {}")).toBe("function setup() {}");
  });

  it("points authors of the old syntax to hyperbook migrate", async () => {
    const file = await process(`::p5{src="testp5.js" editor="true"}\n`, ctx);
    expect(file.messages.map((m) => m.reason).join("\n")).toContain(
      "hyperbook migrate",
    );
  });
});

describe("typst", () => {
  it("collects sources, binaries and fonts", async () => {
    const { workspace } = await workspaceOf(
      `:::typst{mode="edit"}

\`\`\`typ
#include "other.typ"
\`\`\`

\`\`\`typ file="other.typ"
Other
\`\`\`

::file{path="logo.png" src="/logo.png"}
::file{src="/fonts/Fira.otf" font}

:::
`,
      "directive-typst",
    );
    expect(workspace).toEqual({
      main: "main.typ",
      files: [
        { path: "main.typ", content: '#include "other.typ"' },
        { path: "other.typ", content: "Other" },
        { path: "logo.png", url: "/public/logo.png" },
        {
          path: "Fira.otf",
          url: "/public/fonts/Fira.otf",
          hidden: true,
          font: true,
        },
      ],
    });
  });

  it("has no editor in preview mode", async () => {
    const { html, element } = await workspaceOf(
      `:::typst

\`\`\`typ
= Hi
\`\`\`

:::
`,
      "directive-typst",
    );
    expect(element).toContain("preview-only");
    expect(html).not.toContain('class="editor');
    expect(html).not.toContain("ide.bundle.js");
  });
});

describe("graphic comparison", () => {
  const P5 = (attrs: string, extra = "") => `:::p5{mode="editor" ${attrs}}

\`\`\`js
function setup() { createCanvas(100, 100); }
\`\`\`

\`\`\`js file="solution.js" role="solution"
function setup() { createCanvas(100, 100); background(0); }
\`\`\`
${extra}
:::
`;

  it("asks the client to compare, with no Check button", async () => {
    const { html, workspace } = await workspaceOf(
      P5('compare pass=90 frame=30'),
      "directive-p5",
    );
    expect(html).toContain('data-compare="true"');
    expect(html).toContain('data-pass="90"');
    expect(html).toContain('data-frame="30"');
    // Each Update scores the sketch.
    expect(html).not.toContain('class="check"');
    expect(html).toContain('class="p5-frame"');
    // The solution never shows as a tab, even without hidden.
    expect(workspace.files[1]).toMatchObject({
      path: "solution.js",
      role: "solution",
      hidden: true,
    });
  });

  it("needs something to compare with", async () => {
    const file = await process(
      `:::p5{mode="editor" compare}\n\n\`\`\`js\nfunction setup() {}\n\`\`\`\n\n:::\n`,
      ctx,
    );
    expect(String(file.value)).not.toContain("data-compare");
    expect(file.messages.map((m) => m.reason).join("\n")).toContain(
      'role="solution"',
    );
  });

  it("shows the Web IDE's page in a frame of the compared size", async () => {
    const html = String(
      (
        await process(
          `:::webide{compare}

\`\`\`html
<p>Hi</p>
\`\`\`

\`\`\`html file="solution.html" role="solution"
<p>Hello</p>
\`\`\`

:::
`,
          ctx,
        )
      ).value,
    );
    expect(html).toContain('data-compare="true"');
    // The page is scored as the reader types: no Check, no button row.
    expect(html).not.toContain('class="check"');
    // The target lies over the output, which has the compared size.
    expect(html).toContain('style="width: 400px; height: 300px;"');
  });

  it("renders a Web IDE's pages at the size compare gives", async () => {
    const md = (attrs: string) => `:::webide{${attrs}}

\`\`\`html
<p>Hi</p>
\`\`\`

\`\`\`html file="solution.html" role="solution"
<p>Hello</p>
\`\`\`

:::
`;
    const sized = String((await process(md('compare="600x400"'), ctx)).value);
    expect(sized).toContain('style="width: 600px; height: 400px;"');

    const wrong = await process(md('compare="big"'), ctx);
    expect(String(wrong.value)).toContain('style="width: 400px; height: 300px;"');
    expect(wrong.messages.map((m) => m.reason).join("\n")).toContain(
      'compare="400x300"',
    );
  });

  it("needs the canvas in pyide", async () => {
    const md = (attrs: string) => `:::pyide{${attrs}}

\`\`\`python
import turtle
\`\`\`

\`\`\`python file="solution.py" role="solution"
import turtle
turtle.forward(50)
\`\`\`

:::
`;
    const without = await process(md("compare"), ctx);
    expect(String(without.value)).not.toContain("data-compare");
    expect(without.messages.map((m) => m.reason).join("\n")).toContain(
      "canvas",
    );
    const withCanvas = String((await process(md("canvas compare"), ctx)).value);
    expect(withCanvas).toContain('data-compare="true"');
    // Each run scores the drawing; pyide has no Check button.
    expect(withCanvas).not.toContain('class="check"');
  });
});

