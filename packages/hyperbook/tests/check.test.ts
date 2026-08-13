import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { checkBook, normalize, targetOf } from "../check";

describe("targetOf", () => {
  it("ignores targets that are not the book's to resolve", () => {
    expect(targetOf("https://example.com")).toBeNull();
    expect(targetOf("http://example.com")).toBeNull();
    expect(targetOf("mailto:someone@example.com")).toBeNull();
    expect(targetOf("tel:+123")).toBeNull();
    expect(targetOf("data:image/png;base64,AAA")).toBeNull();
    // A bare fragment stays on the current page.
    expect(targetOf("#a-heading")).toBeNull();
    expect(targetOf("")).toBeNull();
  });

  it("strips the fragment and query from an internal target", () => {
    expect(targetOf("/elements/tabs#attributes")).toBe("/elements/tabs");
    expect(targetOf("/page?standalone=true")).toBe("/page");
    expect(targetOf("/page?standalone=true&sections=a,b")).toBe("/page");
  });
});

describe("normalize", () => {
  it("folds the spellings that address the same page", () => {
    expect(normalize("/elements/tabs/")).toBe("/elements/tabs");
    expect(normalize("elements/tabs")).toBe("/elements/tabs");
    expect(normalize("/elements/index")).toBe("/elements");
    expect(normalize("/index")).toBe("/");
  });

  it("strips the source extensions that makeUrl removes", () => {
    // A page's href never carries its extension, but authors link to the file
    // they are editing, so every source spelling has to fold to the same href.
    expect(normalize("/elements/alert.md")).toBe("/elements/alert");
    expect(normalize("/elements/alert.md.hbs")).toBe("/elements/alert");
    expect(normalize("/elements/alert.md.json")).toBe("/elements/alert");
    expect(normalize("/elements/alert.md.yml")).toBe("/elements/alert");
  });

  it("strips the extension before folding away an index", () => {
    // Order matters: ".md" has to go first or "/sub/index.md" never matches.
    expect(normalize("/sub/index.md")).toBe("/sub");
    expect(normalize("/sub/index.md.hbs")).toBe("/sub");
    expect(normalize("/index.md")).toBe("/");
  });

  it("only strips extensions that are actually page sources", () => {
    // ".hbs" alone is not a Hyperbook page; neither is ".mdx".
    expect(normalize("/page.hbs")).toBe("/page.hbs");
    expect(normalize("/page.mdx")).toBe("/page.mdx");
  });

  it("leaves asset extensions alone", () => {
    expect(normalize("/diagram.png")).toBe("/diagram.png");
    expect(normalize("/notes.pdf")).toBe("/notes.pdf");
  });

  it("keeps the root addressable", () => {
    expect(normalize("/")).toBe("/");
    expect(normalize("")).toBe("/");
  });
});

describe("checkBook link resolution", () => {
  let root: string;
  /** Findings keyed by the offending URL, for readable assertions. */
  let broken: string[];

  const write = async (relative: string, contents: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-check-"));

    await write("hyperbook.json", JSON.stringify({ name: "T", language: "en" }));
    // One page per supported source format, so every extension a link might
    // carry has a real target behind it.
    await write("book/chapter.md", "---\nname: Chapter\n---\n# Chapter\n");
    await write("book/templated.md.hbs", "---\nname: Templated\n---\n# T\n");
    await write("book/sub/index.md", "---\nname: Sub\n---\n# Sub\n");
    await write("book/sub/nested.md", "---\nname: Nested\n---\n# Nested\n");
    await write("public/asset.png", "x");

    await write(
      "book/index.md",
      `---
name: Home
---

[a](/chapter) [b](/chapter.md) [c](./chapter.md) [d](/chapter.md#frag)
[e](/templated) [f](/templated.md.hbs) [g](/templated.md.hbs?standalone=true)
[h](/sub) [i](/sub/) [j](/sub/index) [k](/sub/index.md)
[l](/sub/nested.md) [m](sub/nested) [n](/) [o](/index.md)
![p](/asset.png)

[q](/chapter.mdx) [r](/templated.hbs) [s](/missing.md) [t](/asset.jpg)
`,
    );

    const project: Hyperproject = { name: "T", src: root, type: "book" };
    const findings = await checkBook(project);
    broken = findings.map((f) => f.reason.replace(/^.*: /, ""));
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("resolves every valid spelling of a page link", () => {
    // Anything in the first block above must not be reported.
    for (const url of [
      "/chapter",
      "/chapter.md",
      "./chapter.md",
      "/chapter.md#frag",
      "/templated",
      "/templated.md.hbs",
      "/templated.md.hbs?standalone=true",
      "/sub",
      "/sub/",
      "/sub/index",
      "/sub/index.md",
      "/sub/nested.md",
      "sub/nested",
      "/",
      "/index.md",
      "/asset.png",
    ]) {
      expect(broken, `${url} should resolve`).not.toContain(url);
    }
  });

  it("still reports targets that genuinely do not exist", () => {
    expect(broken.sort()).toEqual(
      ["/asset.jpg", "/chapter.mdx", "/missing.md", "/templated.hbs"].sort(),
    );
  });
});

describe("checkBook permaids", () => {
  let root: string;

  const write = async (relative: string, contents: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };

  const page = (name: string, permaid?: string) =>
    `---\nname: ${name}\n${permaid ? `permaid: ${permaid}\n` : ""}---\n# ${name}\n`;

  const run = () =>
    checkBook({ name: "T", src: root, type: "book" } as Hyperproject);

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-permaid-"));
    await write("hyperbook.json", JSON.stringify({ name: "T", language: "en" }));
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("accepts distinct permaids", async () => {
    await write("book/index.md", page("Home"));
    await write("book/a.md", page("A", "alpha"));
    await write("book/b.md", page("B", "beta"));

    expect(await run()).toEqual([]);
  });

  it("reports a permaid claimed by two pages", async () => {
    await write("book/b.md", page("B", "alpha"));

    const findings = await run();
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toContain('Duplicate permaid "alpha"');
    // The diagnostic points at the frontmatter line that has to change.
    expect(findings[0].line).toBe(3);
    expect(findings[0].severity).toBe("error");
  });

  it("reports every page that loses a three-way collision", async () => {
    await write("book/c.md", page("C", "alpha"));

    const findings = await run();
    // Three claimants, one winner, so two pages lose the permalink.
    expect(findings).toHaveLength(2);
    for (const finding of findings) {
      expect(finding.reason).toContain('Duplicate permaid "alpha"');
    }
  });

  it("does not treat a glossary permaid as a valid link target", async () => {
    // Only buildSingleBookPage writes @/<permaid>.html, so a link to a
    // glossary page's permaid would 404.
    await write("book/b.md", page("B", "beta"));
    await write("book/c.md", page("C", "gamma"));
    await write("glossary/term.md", page("Term", "myterm"));
    await write("book/index.md", "---\nname: Home\n---\n\n[a](/@/myterm)\n");

    const findings = await run();
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toContain("/@/myterm");
  });
});

describe("checkBook relative links from index pages", () => {
  let root: string;

  const write = async (relative: string, contents: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };

  const run = () =>
    checkBook({ name: "T", src: root, type: "book" } as Hyperproject);

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-relative-"));
    await write("hyperbook.json", JSON.stringify({ name: "T", language: "en" }));
    await write("book/index.md", "---\nname: Home\n---\n# Home\n");
    await write("book/section/index.md", "---\nname: Section\n---\n# S\n");
    await write("book/section/topic/sub-a/index.md", "---\nname: A\n---\n# A\n");
    await write("book/section/topic/sub-b/index.md", "---\nname: B\n---\n# B\n");
    await write("book/section/topic/page.md", "---\nname: P\n---\n# P\n");
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("resolves relative links from a nested index page against its own directory", async () => {
    // An index page's href IS its directory, so resolving against dirname(href)
    // climbs one level too far and reports working links as broken.
    await write(
      "book/section/topic/index.md",
      `---
name: Topic
---

[a](./sub-a) [b](sub-b) [c](./page) [d](..)
`,
    );

    expect(await run()).toEqual([]);
  });

  it("resolves relative links from a non-index page against its parent", async () => {
    await write(
      "book/section/topic/page.md",
      `---
name: P
---

[a](./sub-a) [b](../topic/sub-b) [c](..)
`,
    );

    expect(await run()).toEqual([]);
  });

  it("still reports a relative target that does not exist", async () => {
    await write(
      "book/section/topic/index.md",
      "---\nname: Topic\n---\n\n[a](./sub-c)\n",
    );

    const findings = await run();
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toContain("./sub-c");
  });
});
