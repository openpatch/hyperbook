import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { vfile } from "../src";

/**
 * Snippets are inlined with String.prototype.replace. A replacement *string*
 * interprets `$&`, `` $` ``, `$'` and `$$` as special patterns, so a snippet
 * body mentioning a spreadsheet reference like `$` or `$$` got corrupted:
 * `` $` `` pasted everything before the snippet into it again, which showed up
 * as nested blocks. The rendered snippet has to be inserted literally.
 */
describe("getMarkdown snippets with dollar signs", () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-dollar-"));
    await fs.mkdir(path.join(root, "book"), { recursive: true });
    await fs.mkdir(path.join(root, "snippets"), { recursive: true });
    await fs.writeFile(
      path.join(root, "hyperbook.json"),
      JSON.stringify({ name: "Dollar" }),
    );
    await fs.writeFile(
      path.join(root, "snippets", "box.md.hbs"),
      "{{{c}}}alert\n\n{{{ content }}}\n\n{{{c}}}",
    );
    await fs.writeFile(
      path.join(root, "snippets", "cost.md.hbs"),
      "costs {{{ price }}}",
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
    return (file as any).markdown.content as string;
  };

  it("keeps special replacement patterns in block snippet content", async () => {
    await fs.writeFile(
      path.join(root, "book", "block.md"),
      [
        "---",
        "name: Block",
        "---",
        "",
        "BEFORE",
        "",
        ":::snippet{#box}",
        "Fix it with `$`, then `$&`, `$'` and `$$`.",
        ":::",
        "",
        "AFTER",
        "",
      ].join("\n"),
    );
    const content = await read("block.md");
    expect(content).toContain("Fix it with `$`, then `$&`, `$'` and `$$`.");
    expect(content.match(/BEFORE/g)).toHaveLength(1);
    expect(content.match(/AFTER/g)).toHaveLength(1);
  });

  it("keeps special replacement patterns in inline snippet variables", async () => {
    await fs.writeFile(
      path.join(root, "book", "inline.md"),
      '---\nname: Inline\n---\n\nBEFORE :snippet{#cost price="$$5 or $`"} AFTER\n',
    );
    const content = await read("inline.md");
    expect(content).toContain("costs $$5 or $` AFTER");
    expect(content.match(/BEFORE/g)).toHaveLength(1);
  });
});
