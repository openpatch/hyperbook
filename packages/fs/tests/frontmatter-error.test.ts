import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMarkdown } from "../src/vfile";
import { FrontmatterParseError } from "../src/errors";

let root: string;

const write = async (name: string, content: string) => {
  await fs.writeFile(path.join(root, "book", name), content);
  return getMarkdown({
    folder: "book",
    name: path.parse(name).name,
    root,
    extension: ".md",
    path: {
      permalink: null,
      directory: "",
      absolute: path.join(root, "book", name),
      relative: name,
      href: "",
    },
  });
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-frontmatter-"));
  await fs.mkdir(path.join(root, "book"), { recursive: true });
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({ name: "Book" }),
  );
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("broken frontmatter", () => {
  it("names the file and the line the YAML parser tripped on", async () => {
    // An unquoted value holding ": " reads as a second mapping key.
    const error = await write(
      "colon.md",
      '---\ntitle: Text als Daten: Tokenisierung\nindex: 1\n---\n\n# Hi\n',
    ).catch((e) => e);

    expect(error).toBeInstanceOf(FrontmatterParseError);
    expect(error.file).toBe(path.join(root, "book", "colon.md"));
    expect(error.line).toBe(2);
    expect(error.reason).toContain("mapping");
    // The offending line is quoted back with the fix for this exact mistake.
    expect(error.reason).toContain("title: Text als Daten: Tokenisierung");
    expect(error.reason).toContain(
      'has to be quoted: title: "Text als Daten: Tokenisierung"',
    );
  });

  it("points at the line that failed, not at the first one", async () => {
    const error = await write(
      "duplicate.md",
      "---\ntitle: Ok\ntitle: Again\n---\n\n# Hi\n",
    ).catch((e) => e);

    expect(error).toBeInstanceOf(FrontmatterParseError);
    expect(error.line).toBe(3);
    expect(error.reason).toContain("duplicated mapping key");
    // The path and position are rendered by the caller, so the message the CLI
    // prints carries them too.
    expect(error.message).toContain("duplicate.md:3:");
  });

  it("leaves valid frontmatter alone", async () => {
    const { data } = await write(
      "fine.md",
      '---\ntitle: "Text als Daten: Tokenisierung"\nindex: 1\n---\n\n# Hi\n',
    );
    expect(data.title).toBe("Text als Daten: Tokenisierung");
    expect(data.index).toBe(1);
  });
});
