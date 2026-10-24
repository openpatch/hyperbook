import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { hyperbook } from "@hyperbook/fs";
import { process as hyperbookProcess } from "@hyperbook/markdown";
import { VFile } from "vfile";
import { makeBaseCtx } from "../build";
import { runMigrate } from "../migrate";
import { applyEdits, blankFrontmatter } from "../migrate/edits";
import {
  findAttributeBlock,
  formatAttributes,
} from "../migrate/directiveAttributes";

let root: string;
let logs: string[];

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-migrate-"));
  await fs.mkdir(path.join(root, "book"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({ name: "T" }),
  );
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...a) => {
    logs.push(a.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...a) => {
    logs.push(a.join(" "));
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

const project = (): Hyperproject =>
  ({ name: "T", src: root, type: "book" }) as Hyperproject;

const page = (name: string) => path.join(root, "book", name);

const write = (name: string, content: string) =>
  fs.writeFile(page(name), content);

const read = (name: string) => fs.readFile(page(name), "utf8");

const migrate = () => runMigrate(project(), { force: true });

/** Renders a page as the build would and returns its pyides' ids and workspaces. */
const render = async (content: string) => {
  const hyperbookJson = await hyperbook.getJson(root);
  const ctx = {
    ...makeBaseCtx(root, hyperbookJson, undefined, project()),
    navigation: {
      current: null,
      next: null,
      previous: null,
      pages: [],
      sections: [],
      glossary: [],
    },
  } as any;
  const html = String(
    (await hyperbookProcess(new VFile({ value: content }), ctx)).value,
  );
  return [
    ...html.matchAll(
      /class="directive-pyide(?: [^"]*)?"[^>]*?id="([^"]+)"(?:[^>]*?data-workspace="([^"]*)")?/g,
    ),
  ].map(([, id, workspace]) => ({
    id,
    workspace: workspace
      ? JSON.parse(Buffer.from(workspace, "base64").toString("utf8"))
      : null,
  }));
};

const OLD = `---
name: Lesson
---

# Loops {{not handlebars here}}

:::pyide{packages="numpy"}

\`\`\`python
for i in range(3):
    print(i)
\`\`\`

\`\`\`python test
#SCRIPT#
print("checked")
\`\`\`

:::

Text after.
`;

describe("hyperbook migrate: pyide", () => {
  it("rewrites the old test syntax and keeps everything else byte for byte", async () => {
    await write("index.md", OLD);
    await migrate();
    const after = await read("index.md");

    expect(after).toContain(
      '```python file="test_1.py" role="test" hidden\n#SCRIPT#',
    );
    // The main block keeps working as it is: an unnamed python block.
    expect(after).toContain("```python\nfor i in range(3):");
    // Only the opening line and the test fence changed.
    const changed = OLD.split("\n").filter(
      (line, i) => after.split("\n")[i] !== line,
    );
    expect(changed).toEqual([':::pyide{packages="numpy"}', "```python test"]);
  });

  it("pins the id readers' saved code is stored under", async () => {
    const [before] = await render(OLD.replace(/^---[\s\S]*?---\n/, ""));
    await write("index.md", OLD);
    await migrate();
    const after = await read("index.md");

    expect(after).toContain(`:::pyide{id="${before.id}" packages="numpy"}`);
    const [rendered] = await render(after.replace(/^---[\s\S]*?---\n/, ""));
    expect(rendered.id).toBe(before.id);
    expect(rendered.workspace.files).toEqual([
      { path: "main.py", content: "for i in range(3):\n    print(i)" },
      {
        path: "test_1.py",
        content: '#SCRIPT#\nprint("checked")',
        hidden: true,
        role: "test",
      },
    ]);
  });

  it("gives identical directives the distinct ids they had", async () => {
    const twice = `${OLD}\n${OLD.replace(/^---[\s\S]*?---\n/, "")}`;
    const before = await render(twice.replace(/^---[\s\S]*?---\n/, ""));
    expect(before[1].id).toBe(`${before[0].id}-2`);

    await write("index.md", twice);
    await migrate();
    const after = await render(
      (await read("index.md")).replace(/^---[\s\S]*?---\n/, ""),
    );
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
  });

  it("matches ids through templates in .md.hbs pages", async () => {
    const hbs = `---
name: T
---

{{#if true}}Shown{{/if}}

:::pyide

\`\`\`python
print(1)
\`\`\`

\`\`\`python test
#SCRIPT#
\`\`\`

:::
`;
    await write("hbs.md.hbs", hbs);
    await migrate();
    const after = await read("hbs.md.hbs");
    expect(after).toContain("{{#if true}}Shown{{/if}}");
    expect(after).toMatch(/:::pyide\{id="[0-9a-f]+"\}/);
  });

  it("turns src= into a ::file line, making a leaf a container", async () => {
    await fs.writeFile(path.join(root, "public", "script.py"), "print('x')\n");
    const old = '::pyide{src="script.py" canvas}\n';
    const [before] = await render(old);
    await write("index.md", old);
    await migrate();
    const after = await read("index.md");

    expect(after).toBe(
      `:::pyide{id="${before.id}" canvas}\n::file{path="main.py" src="script.py"}\n:::\n`,
    );
    const [rendered] = await render(after);
    expect(rendered.id).toBe(before.id);
    expect(rendered.workspace.files).toEqual([
      { path: "main.py", content: "print('x')\n" },
    ]);
  });

  it("leaves an explicit id alone", async () => {
    await write("index.md", OLD.replace("{packages", '{id="loops" packages'));
    await migrate();
    expect(await read("index.md")).toContain(
      ':::pyide{id="loops" packages="numpy"}',
    );
  });

  it("does nothing the second time", async () => {
    await write("index.md", OLD);
    await migrate();
    const once = await read("index.md");
    await migrate();
    expect(await read("index.md")).toBe(once);
  });

  it("does not touch a pyide that needs no change, nor examples in code fences", async () => {
    const content = `:::pyide

\`\`\`python
print(1)
\`\`\`

:::

\`\`\`\`md
:::pyide
\`\`\`python test
#SCRIPT#
\`\`\`
:::
\`\`\`\`
`;
    await write("index.md", content);
    await migrate();
    expect(await read("index.md")).toBe(content);
  });

  it("reports blocks the pyide never used instead of changing them", async () => {
    const content = `:::pyide

\`\`\`python
print(1)
\`\`\`

\`\`\`python
print("second, ignored")
\`\`\`

:::
`;
    await write("index.md", content);
    await migrate();
    expect(await read("index.md")).toBe(content);
    expect(logs.join("\n")).toContain("never used by the pyide");
  });

  it("leaves the files alone in a dry run", async () => {
    await write("index.md", OLD);
    await runMigrate(project(), { dryRun: true });
    expect(await read("index.md")).toBe(OLD);
    expect(logs.join("\n")).toContain('+ ```python file="test_1.py"');
  });
});

describe("hyperbook migrate: every IDE", () => {
  /**
   * The ids Hyperbook 0.114.5 -- the last release with the old syntax --
   * gave the IDEs of fixtures/migrate/all-ides.md, read from its rendered
   * page. Readers' saved work is stored under exactly these.
   */
  const RELEASED_IDS = [
    "pyide a5e029b63c1a474fa6a6e2216fb7f237e1a4a0567497d0b51c7f8e6264a35af9",
    "pyide 8771113a4637079ca6b63bd9094280d9cb342c0c5bb5d7e7a846ab4666eb9764",
    "p5 57d133376c40f6798dd25ece2714f1f4e19ca3044263cf0de9241198bb1a6bcb",
    "p5 41d633b669ab3e808048e5d04821d767dcb3f216c1dd78fb4e9a1508893c1369",
    "p5 41d633b669ab3e808048e5d04821d767dcb3f216c1dd78fb4e9a1508893c1369-2",
    "openscad c32a482603fe6ab9df4619333cad20c5dc044fb2f229848afac2dc517a46be37",
    "typst b1c60f1d3f22fb7bcda271e6b4d7d76c0612752d2b24e3610a3d67413b2a6f77",
  ];

  const setupBook = async () => {
    await write(
      "index.md",
      await fs.readFile(
        path.join(__dirname, "fixtures", "migrate", "all-ides.md"),
        "utf8",
      ),
    );
    const publicDir = path.join(root, "public");
    await fs.writeFile(path.join(publicDir, "script.py"), 'print("x")\n');
    await fs.writeFile(path.join(publicDir, "sketch.js"), "function setup(){}\n");
    await fs.writeFile(path.join(publicDir, "model.stl"), "solid x\nendsolid x\n");
    await fs.writeFile(path.join(publicDir, "other.typ"), "Other\n");
  };

  /** Each IDE's id as the page renders it, in document order. */
  const renderedIds = async (content: string) => {
    const hyperbookJson = await hyperbook.getJson(root);
    const ctx = {
      ...makeBaseCtx(root, hyperbookJson, undefined, project()),
      navigation: {
        current: null,
        next: null,
        previous: null,
        pages: [],
        sections: [],
        glossary: [],
      },
    } as any;
    const html = String(
      (
        await hyperbookProcess(
          new VFile({ value: content.replace(/^---[\s\S]*?---\n/, "") }),
          ctx,
        )
      ).value,
    );
    // The p5 template attribute holds raw markup, so look for the id directly.
    return [
      ...html.matchAll(
        /<div class="directive-(pyide|p5|openscad|typst)[^"]*"[\s\S]*? (?:data-id|id)="([^"]+)"/g,
      ),
    ].map(([, name, id]) => `${name} ${id}`);
  };

  it("keeps the ids the released version gave every IDE", async () => {
    await setupBook();
    await migrate();
    expect(await renderedIds(await read("index.md"))).toEqual(RELEASED_IDS);
  });

  it("converts p5, openscad and typst to the workspace syntax", async () => {
    await setupBook();
    await migrate();
    const after = await read("index.md");
    expect(after).toContain(
      `:::p5{id="${RELEASED_IDS[2].split(" ")[1]}" height="400" mode="editor"}`,
    );
    expect(after).toContain('::file{path="sketch.js" src="sketch.js"}');
    expect(after).toContain('::file{path="input/model.stl" src="model.stl"}');
    expect(after).toContain('::file{path="other.typ" src="other.typ"}');
    expect(after).toContain('```typ file="chapter.typ"');
    expect(after).not.toMatch(/@file|@source|editor=true/);
  });

  it("does nothing the second time", async () => {
    await setupBook();
    await migrate();
    const once = await read("index.md");
    await migrate();
    expect(await read("index.md")).toBe(once);
  });
});

describe("hyperbook migrate: single rules", () => {
  it("names typst's main file when it was not main.typ", async () => {
    await write(
      "index.md",
      ":::typst\n\n```typ doc.typ\n= Doc\n```\n\n:::\n",
    );
    await migrate();
    expect(await read("index.md")).toMatch(
      /:::typst\{id="[0-9a-f]+" main="doc.typ"\}\n\n```typ file="doc.typ"/,
    );
  });

  it("turns typst fonts into ::file lines", async () => {
    await write(
      "index.md",
      ':::typst\n\n@font src="/fonts/Fira.otf"\n\n```typ\n= Doc\n```\n\n:::\n',
    );
    await migrate();
    expect(await read("index.md")).toContain('::file{src="/fonts/Fira.otf" font}');
  });

  it("builds webide's index.html from the old default template", async () => {
    await write(
      "index.md",
      ":::webide\n\n```html\n<h1>Hi</h1>\n```\n\n```css\nh1 { color: red; }\n```\n\n```js\nconsole.log(1);\n```\n\n:::\n",
    );
    await migrate();
    const after = await read("index.md");
    expect(after).toContain("<body><h1>Hi</h1></body>");
    expect(after).toContain('</style>\n<link rel="stylesheet" href="style.css" />');
    expect(after).toContain('<script type="text/javascript" src="script.js"></script>');
    expect(after).toContain('```css file="style.css"');
    expect(after).toContain('```js file="script.js"');
    // Nobody saved webide work, so no id is pinned.
    expect(after).toMatch(/^:::webide\n/);
  });

  it("leaves a webide in the new syntax alone", async () => {
    const named =
      ':::webide\n\n```html\n<h1>Hi</h1>\n```\n\n```css file="style.css"\nh1 {}\n```\n\n:::\n';
    const page =
      ":::webide\n\n```html\n<!DOCTYPE html>\n<html><body>Hi</body></html>\n```\n\n:::\n";
    await write("index.md", `${named}\n${page}`);
    await migrate();
    expect(await read("index.md")).toBe(`${named}\n${page}`);
  });

  it("leaves a webide template whose script is not separable alone", async () => {
    const content =
      ':::webide\n\n```html template\n<script>let a = 1; ###JS###</script>###HTML###\n```\n\n:::\n';
    await write("index.md", content);
    await migrate();
    expect(await read("index.md")).toBe(content);
    expect(logs.join("\n")).toContain("###JS###");
  });

  const writeSnippet = async (content: string) => {
    await fs.mkdir(path.join(root, "snippets"), { recursive: true });
    const snippet = path.join(root, "snippets", "fonts.md.hbs");
    await fs.writeFile(snippet, content);
    return snippet;
  };
  const OLD_SNIPPET =
    '@font src="/fonts/Noto.ttf"\n@file dest="/logo.png" src="logo.png"\n\n```md\n@font src="/example.ttf"\n```\n';

  it("converts the old file lines of snippets pasted into typst", async () => {
    const snippet = await writeSnippet(OLD_SNIPPET);
    await write(
      "index.md",
      ":::typst\n\n::snippet{#fonts}\n\n```typ\n= Hi\n```\n\n:::\n",
    );
    await migrate();
    expect(await fs.readFile(snippet, "utf8")).toBe(
      '::file{src="/fonts/Noto.ttf" font}\n::file{path="logo.png" src="logo.png"}\n\n```md\n@font src="/example.ttf"\n```\n',
    );
  });

  it("leaves snippets alone that the Online IDE uses too", async () => {
    const snippet = await writeSnippet(OLD_SNIPPET);
    await write(
      "index.md",
      ":::typst\n\n::snippet{#fonts}\n\n```typ\n= Hi\n```\n\n:::\n\n:::onlineide\n\n::snippet{#fonts}\n\n:::\n",
    );
    await migrate();
    expect(await fs.readFile(snippet, "utf8")).toBe(OLD_SNIPPET);
    expect(logs.join("\n")).toContain("also used outside typst and openscad");
  });

  it("never touches the Online IDE's @file lines on a page", async () => {
    const content =
      ':::onlineide\n\n@file dest="sky.jpg" src="/clouds.jpg"\n\n```java Main.java\nint a;\n```\n\n:::\n';
    await write("index.md", content);
    await migrate();
    expect(await read("index.md")).toBe(content);
  });

  it("leaves a p5 in the new syntax alone", async () => {
    const content =
      ':::p5{mode="editor" height=300}\n\n```js\nfunction setup() {}\n```\n\n```js file="colors.js"\nfunction c() {}\n```\n\n:::\n';
    await write("index.md", content);
    await migrate();
    expect(await read("index.md")).toBe(content);
  });

  it("reports p5 text that was part of the sketch", async () => {
    await write(
      "index.md",
      ":::p5\n\n```js\nfunction setup() {}\n```\n\n```js\nfunction draw() {}\n```\n\n:::\n",
    );
    await migrate();
    expect(logs.join("\n")).toContain("ran all of its text as one sketch");
  });
});

describe("edits", () => {
  it("applies edits back to front", () => {
    expect(
      applyEdits("abcdef", [
        { start: 1, end: 2, text: "B" },
        { start: 4, end: 4, text: "!" },
      ]),
    ).toBe("aBcd!ef");
  });

  it("refuses overlapping edits", () => {
    expect(() =>
      applyEdits("abcdef", [
        { start: 1, end: 3, text: "" },
        { start: 2, end: 4, text: "" },
      ]),
    ).toThrow("Overlapping");
  });

  it("blanks front matter without moving offsets", () => {
    const source = "---\nname: x\n---\n# Hi";
    const blanked = blankFrontmatter(source);
    expect(blanked).toHaveLength(source.length);
    expect(blanked.indexOf("# Hi")).toBe(source.indexOf("# Hi"));
    expect(blanked).not.toContain("name");
  });
});

describe("directive attributes", () => {
  it("finds the block, quotes and labels included", () => {
    const source = ':::pyide[Label]{title="a}b" canvas}\n';
    const block = findAttributeBlock(source, 0, "pyide")!;
    expect(source.slice(block.start, block.end)).toBe('{title="a}b" canvas}');
  });

  it("points after the name when there is no block", () => {
    expect(findAttributeBlock(":::pyide\n", 0, "pyide")).toEqual({
      start: 8,
      end: 8,
    });
  });

  it("writes flags bare and values quoted", () => {
    expect(formatAttributes({ id: "a", canvas: "", t: 'say "hi"' })).toBe(
      `{id="a" canvas t='say "hi"'}`,
    );
    expect(formatAttributes({})).toBe("");
  });
});
