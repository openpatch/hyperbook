import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hyperbook } from "../src";
import { HyperbookPage, HyperbookSection } from "@hyperbook/types/dist";

/**
 * Builds a throwaway book rather than extending the shared fixture, which is
 * pinned by snapshots in the other suites.
 */
describe("protect inheritance", () => {
  let root: string;

  const page = (relative: string, frontmatter: string, body = "content") =>
    fs
      .mkdir(path.join(root, "book", path.dirname(relative)), {
        recursive: true,
      })
      .then(() =>
        fs.writeFile(
          path.join(root, "book", relative),
          `---\n${frontmatter}\n---\n\n${body}\n`,
        ),
      );

  const find = (
    sections: HyperbookSection[],
    name: string,
  ): HyperbookSection | undefined => {
    for (const section of sections) {
      if (section.name === name) return section;
      const nested = find(section.sections, name);
      if (nested) return nested;
    }
  };

  const pageIn = (section: HyperbookSection, name: string) =>
    section.pages.find((p) => p.name === name) as HyperbookPage;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-protect-"));
    await fs.mkdir(path.join(root, "book"), { recursive: true });
    await fs.writeFile(
      path.join(root, "hyperbook.json"),
      JSON.stringify({ name: "Protect" }),
    );
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("leaves an unprotected book alone", async () => {
    await page("index.md", "name: Home");
    await page("solutions/index.md", "name: Solutions");
    await page("solutions/one.md", "name: One");

    const { sections, pages } = await hyperbook.getPagesAndSections(root);
    expect(pages[0].protect).toBeUndefined();
    const solutions = find(sections, "Solutions")!;
    expect(solutions.protect).toBeUndefined();
    expect(pageIn(solutions, "One").protect).toBeUndefined();
  });

  it("pushes a section's protect onto its pages", async () => {
    await page("index.md", "name: Home");
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/one.md", "name: One");

    const { sections, pages } = await hyperbook.getPagesAndSections(root);

    // A sibling outside the section is untouched.
    expect(pages[0].protect).toBeUndefined();

    const solutions = find(sections, "Solutions")!;
    expect(solutions.protect).toBe("chapter-3");
    expect(solutions.protectInherited).toBeUndefined();

    const one = pageIn(solutions, "One");
    expect(one.protect).toBe("chapter-3");
    expect(one.protectInherited).toBe(true);
  });

  it("reaches nested sections", async () => {
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/deep/index.md", "name: Deep");
    await page("solutions/deep/two.md", "name: Two");

    const { sections } = await hyperbook.getPagesAndSections(root);
    const deep = find(sections, "Deep")!;
    expect(deep.protect).toBe("chapter-3");
    expect(deep.protectInherited).toBe(true);
    expect(pageIn(deep, "Two").protect).toBe("chapter-3");
  });

  it("lets a page override its section", async () => {
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/one.md", "name: One\nprotect: own-key");

    const { sections } = await hyperbook.getPagesAndSections(root);
    const one = pageIn(find(sections, "Solutions")!, "One");
    expect(one.protect).toBe("own-key");
    expect(one.protectInherited).toBeUndefined();
  });

  it("lets a nested section override its parent", async () => {
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/deep/index.md", "name: Deep\nprotect: deep-key");
    await page("solutions/deep/two.md", "name: Two");

    const { sections } = await hyperbook.getPagesAndSections(root);
    const deep = find(sections, "Deep")!;
    expect(deep.protect).toBe("deep-key");
    expect(deep.protectInherited).toBeUndefined();
    // Protection is not additive: readers of the nested section only need the
    // nested password.
    expect(pageIn(deep, "Two").protect).toBe("deep-key");
  });

  it("points every inheriting page at the section that declared it", async () => {
    // This is what makes one unlock cover the whole section: the pages share a
    // protect source, and the client keys the unlock on that.
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/one.md", "name: One");
    await page("solutions/two.md", "name: Two");
    await page("solutions/deep/index.md", "name: Deep");
    await page("solutions/deep/three.md", "name: Three");

    const { sections } = await hyperbook.getPagesAndSections(root);
    const solutions = find(sections, "Solutions")!;
    const deep = find(sections, "Deep")!;

    expect(solutions.protectSource).toBe("/solutions");
    for (const p of ["One", "Two"]) {
      expect(pageIn(solutions, p).protectSource).toBe("/solutions");
    }
    // Nested, still inheriting: same source, so still one unlock.
    expect(deep.protectSource).toBe("/solutions");
    expect(pageIn(deep, "Three").protectSource).toBe("/solutions");
  });

  it("gives an overriding subsection its own protect source", async () => {
    await page("solutions/index.md", "name: Solutions\nprotect: chapter-3");
    await page("solutions/one.md", "name: One");
    await page("solutions/deep/index.md", "name: Deep\nprotect: deep-key");
    await page("solutions/deep/two.md", "name: Two");

    const { sections } = await hyperbook.getPagesAndSections(root);
    const solutions = find(sections, "Solutions")!;
    const deep = find(sections, "Deep")!;

    expect(pageIn(solutions, "One").protectSource).toBe("/solutions");
    // A different password must not be unlocked by the parent's.
    expect(deep.protectSource).toBe("/solutions/deep");
    expect(pageIn(deep, "Two").protectSource).toBe("/solutions/deep");
  });

  it("gives a page with its own protect its own source", async () => {
    await page("index.md", "name: Home");
    await page("secret.md", "name: Secret\nprotect: own-key");

    const { pages } = await hyperbook.getPagesAndSections(root);
    const secret = pages.find((p) => p.name === "Secret")!;
    expect(secret.protectSource).toBe("/secret");
    expect(secret.protectInherited).toBeUndefined();
  });

  it("carries the object form through unchanged", async () => {
    await page(
      "solutions/index.md",
      'name: Solutions\nprotect:\n  password: literal\n  description: Ask your teacher',
    );
    await page("solutions/one.md", "name: One");

    const { sections } = await hyperbook.getPagesAndSections(root);
    expect(pageIn(find(sections, "Solutions")!, "One").protect).toEqual({
      password: "literal",
      description: "Ask your teacher",
    });
  });
});
