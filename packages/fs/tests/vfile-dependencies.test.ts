import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { vfile } from "../src";

/**
 * Paths are relative to the book root, so they stay portable across machines.
 *
 * getMarkdown inlines templates and snippets into a page. The dev server needs
 * to know which files those were, otherwise editing a snippet cannot be mapped
 * back to the pages that use it.
 */
describe("getMarkdown dependencies", () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-deps-"));
    await fs.mkdir(path.join(root, "book"), { recursive: true });
    await fs.mkdir(path.join(root, "snippets"), { recursive: true });
    await fs.mkdir(path.join(root, "templates"), { recursive: true });
    await fs.writeFile(
      path.join(root, "hyperbook.json"),
      JSON.stringify({ name: "Deps" }),
    );
    await fs.writeFile(
      path.join(root, "snippets", "note.md.hbs"),
      "A snippet body",
    );
    await fs.writeFile(
      path.join(root, "templates", "card.md.hbs"),
      "# {{title}}",
    );
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = async (name: string) => {
    const files = await vfile.listForFolder(root, "book");
    vfile.clean(root);
    const file = files.find((f) => f.path.absolute.endsWith(name));
    expect(file, `fixture ${name} was not picked up`).toBeDefined();
    return (file as any).markdown;
  };

  it("records no dependencies for a plain markdown page", async () => {
    await fs.writeFile(
      path.join(root, "book", "plain.md"),
      "---\nname: Plain\n---\n\nJust text.\n",
    );
    const markdown = await read("plain.md");
    expect(markdown.dependencies).toEqual([]);
  });

  it("records the snippet it inlines", async () => {
    await fs.writeFile(
      path.join(root, "book", "with-snippet.md"),
      "---\nname: WithSnippet\n---\n\n:snippet{#note}\n",
    );
    const markdown = await read("with-snippet.md");
    expect(markdown.dependencies).toContain(
      path.join("snippets", "note.md.hbs"),
    );
    expect(markdown.content).toContain("A snippet body");
  });

  it("records the template a .md.json page renders through", async () => {
    await fs.writeFile(
      path.join(root, "book", "from-template.md.json"),
      JSON.stringify({ name: "FromTemplate", template: "card", title: "Hi" }),
    );
    const markdown = await read("from-template.md.json");
    expect(markdown.dependencies).toContain(
      path.join("templates", "card.md.hbs"),
    );
  });
});
