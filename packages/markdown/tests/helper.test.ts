import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { HyperbookContext } from "@hyperbook/types";
import { readFile } from "../src/helper";

/**
 * Directives with a `src=` attribute inline the file at build time. readFile
 * reports every path it looked at, so the dev server can rebuild the pages that
 * depend on a file when it changes — including a file that did not exist yet.
 */
describe("readFile", () => {
  let root: string;

  const makeCtx = (
    dependencies?: Set<string>,
    directory = "",
  ): HyperbookContext =>
    ({
      root,
      navigation: { current: { path: { directory } } },
      dependencies,
    }) as unknown as HyperbookContext;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-readfile-"));
    await fs.mkdir(path.join(root, "public"), { recursive: true });
    await fs.mkdir(path.join(root, "book", "sub"), { recursive: true });
    await fs.writeFile(path.join(root, "public", "a.py"), "from public");
    await fs.writeFile(path.join(root, "book", "b.py"), "from book");
    await fs.writeFile(path.join(root, "book", "sub", "c.py"), "from page dir");
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("reads from public/", () => {
    expect(readFile("a.py", makeCtx())).toBe("from public");
  });

  it("reads from book/", () => {
    expect(readFile("b.py", makeCtx())).toBe("from book");
  });

  it("reads relative to the page's own directory", () => {
    expect(readFile("c.py", makeCtx(undefined, "sub"))).toBe("from page dir");
  });

  it("returns null when the file is nowhere", () => {
    expect(readFile("missing.py", makeCtx())).toBeNull();
  });

  it("records the resolved file as a dependency", () => {
    const dependencies = new Set<string>();
    readFile("a.py", makeCtx(dependencies));
    expect(dependencies.has(path.join(root, "public", "a.py"))).toBe(true);
  });

  it("records candidates that did not exist, so creating one later is noticed", () => {
    const dependencies = new Set<string>();
    readFile("later.py", makeCtx(dependencies, "sub"));
    expect([...dependencies].sort()).toEqual(
      [
        path.join(root, "public", "later.py"),
        path.join(root, "book", "later.py"),
        path.join(root, "book", "sub", "later.py"),
      ].sort(),
    );
  });

  it("works without a dependency collector", () => {
    expect(() => readFile("a.py", makeCtx(undefined))).not.toThrow();
  });

  it("stops at the first hit rather than reading every candidate", () => {
    // book/b.py exists; public/b.py does not, so only the two are considered.
    const dependencies = new Set<string>();
    readFile("b.py", makeCtx(dependencies));
    expect(dependencies.has(path.join(root, "book", "sub", "b.py"))).toBe(
      false,
    );
    expect(fsSync.existsSync(path.join(root, "book", "b.py"))).toBe(true);
  });
});
