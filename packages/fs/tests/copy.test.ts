import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { copy } from "../src/copy";

describe("copy", () => {
  it("copies a tree, creates missing parents and honours the filter", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-copy-"));
    const src = path.join(tmp, "src");
    await fs.mkdir(path.join(src, "a", "skip"), { recursive: true });
    await fs.writeFile(path.join(src, "a", "one.txt"), "1");
    await fs.writeFile(path.join(src, "a", "skip", "two.txt"), "2");
    await fs.writeFile(path.join(src, "three.txt"), "3");

    const dest = path.join(tmp, "out", "deep");
    await copy(src, dest, { filter: (p) => !p.endsWith("skip") });

    expect(await fs.readFile(path.join(dest, "a", "one.txt"), "utf8")).toBe("1");
    expect(await fs.readFile(path.join(dest, "three.txt"), "utf8")).toBe("3");
    await expect(fs.access(path.join(dest, "a", "skip"))).rejects.toThrow();

    await fs.writeFile(path.join(src, "three.txt"), "new");
    await copy(path.join(src, "three.txt"), path.join(dest, "three.txt"));
    expect(await fs.readFile(path.join(dest, "three.txt"), "utf8")).toBe("new");

    await fs.rm(tmp, { recursive: true, force: true });
  });
});
