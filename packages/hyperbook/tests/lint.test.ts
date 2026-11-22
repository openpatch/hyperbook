import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { lint, runLint } from "../lint";

describe("hyperbook lint", () => {
  let root: string;
  let project: Hyperproject;

  const write = async (relative: string, contents: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-lint-"));
    await write(
      "hyperbook.json",
      JSON.stringify({ name: "T", language: "en" }),
    );
    await write(
      "book/index.md",
      "---\nname: Home\n---\n\n# Home\n\n:::alert{info}\nFine.\n:::\n",
    );
    await write(
      "book/broken.md",
      [
        "---",
        "name: Broken",
        "---",
        "",
        ":::alret{info}",
        "Typo.",
        ":::",
        "",
        "[gone](/missing)",
        "",
        ':::collapsible{title="Never closed"}',
        "Swallows the rest.",
        "",
      ].join("\n"),
    );
    await write(
      "book/media.md",
      '---\nname: Media\n---\n\n::video{src="/nope.mp4" titel="Intro"}\n',
    );
    project = { name: "T", src: root, type: "book" };
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("reports problems with their rule and their line in the source", async () => {
    const { findings, pages } = await lint(project, { cwd: root });
    expect(pages).toHaveLength(3);

    const broken = findings.filter((f) => f.file.endsWith("broken.md"));
    // Lines count the frontmatter, like the author's editor does.
    expect(broken).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 5,
          rule: "unknown-directive",
          severity: "warning",
        }),
        expect.objectContaining({
          line: 9,
          rule: "broken-link",
          severity: "error",
        }),
        expect.objectContaining({
          line: 11,
          rule: "unclosed-directive",
          severity: "warning",
        }),
      ]),
    );
    expect(findings.filter((f) => f.file.endsWith("index.md"))).toEqual([]);
  });

  it("reports missing files and unknown attributes on elements", async () => {
    const { findings } = await lint(project, {
      cwd: root,
      paths: ["book/media.md"],
    });
    expect(findings.map((f) => [f.line, f.rule])).toEqual([
      [5, "missing-file"],
      [5, "unknown-attribute"],
    ]);
    expect(findings[1]!.message).toContain('Did you mean "title"?');
  });

  it("only lints the pages it is given", async () => {
    const { findings, pages } = await lint(project, {
      cwd: root,
      paths: ["book/index.md"],
    });
    expect(pages).toEqual([path.join(root, "book", "index.md")]);
    expect(findings).toEqual([]);
  });

  it("says so when a path is not a page of the book", async () => {
    const { findings } = await lint(project, {
      cwd: root,
      paths: ["notes/todo.md"],
    });
    expect(findings).toEqual([
      expect.objectContaining({ rule: "not-a-page", severity: "error" }),
    ]);
  });

  it("prints JSON alone on stdout and fails on warnings", async () => {
    const out: string[] = [];
    const write = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    let ok: boolean;
    try {
      ok = await runLint(project, { cwd: root, json: true });
    } finally {
      process.stdout.write = write;
    }
    expect(ok).toBe(false);
    const report = JSON.parse(out.join(""));
    expect(report).toMatchObject({ ok: false, pages: 3, errors: 1 });
    expect(report.findings[0].file).toBe(path.join("book", "broken.md"));
  });

  it("passes a clean page", async () => {
    expect(
      await runLint(project, {
        cwd: root,
        json: true,
        paths: ["book/index.md"],
      }),
    ).toBe(true);
  });
});
