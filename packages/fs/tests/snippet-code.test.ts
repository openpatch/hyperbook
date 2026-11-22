import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { vfile } from "../src";

/**
 * Snippets are expanded on the raw text. A page that only *mentions* a
 * snippet in code — documentation on how to use them — had the mention
 * expanded, which swallowed everything up to the next `:::`.
 */
describe("getMarkdown snippets and code", () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-snippet-code-"));
    await fs.mkdir(path.join(root, "book"), { recursive: true });
    await fs.mkdir(path.join(root, "snippets"), { recursive: true });
    await fs.writeFile(
      path.join(root, "hyperbook.json"),
      JSON.stringify({ name: "Code" }),
    );
    await fs.writeFile(
      path.join(root, "snippets", "box.md.hbs"),
      "{{{c}}}alert\n\n{{{ content }}}\n\n{{{c}}}",
    );
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = async (name: string, lines: string[]) => {
    await fs.writeFile(
      path.join(root, "book", name),
      ["---", "name: T", "---", "", ...lines].join("\n"),
    );
    const files = await vfile.listForFolder(root, "book");
    vfile.clean(root);
    return (files.find((f) => f.path.absolute.endsWith(name)) as any).markdown
      .content as string;
  };

  it("leaves a snippet mentioned in inline code alone", async () => {
    const content = await read("inline.md", [
      "Use `:::snippet{#box}` for boxes.",
      "",
      ":::alert{info}",
      "Still here.",
      ":::",
    ]);
    expect(content).toContain("Use `:::snippet{#box}` for boxes.");
    expect(content).toContain(":::alert{info}\nStill here.\n:::");
  });

  it("leaves a snippet shown in a code block alone", async () => {
    const content = await read("fenced.md", [
      "```md",
      ":::snippet{#box}",
      "Example",
      ":::",
      "```",
    ]);
    expect(content).toContain("```md\n:::snippet{#box}\nExample\n:::\n```");
  });

  it("still expands a snippet next to code, keeping the code in its body", async () => {
    const content = await read("mixed.md", [
      "Write `x`.",
      "",
      ":::snippet{#box}",
      "Close a block with `:::` on its own line.",
      ":::",
      "",
      "After.",
    ]);
    // The ::: in inline code does not end the snippet.
    expect(content).toBe(
      "\nWrite `x`.\n\n:::alert\n\n\nClose a block with `:::` on its own line.\n\n\n:::\n\nAfter.",
    );
  });
});
