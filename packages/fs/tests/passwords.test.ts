import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearPasswordCache, getPasswords, withReferencedKeys } from "../src";

const ENV_KEYS = [
  "HYPERBOOK_PASSWORDS",
  "HYPERBOOK_PASSWORDS_FILE",
  "HYPERBOOK_PASSWORD_CHAPTER_3",
  "HYPERBOOK_PASSWORD_SOLUTIONS",
];

describe("getPasswords", () => {
  let root: string;

  const write = (name: string, registry: unknown) =>
    fs.writeFile(path.join(root, name), JSON.stringify(registry));

  // The registry is cached per root, so every case gets a fresh directory.
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-passwords-"));
    for (const key of ENV_KEYS) delete process.env[key];
    clearPasswordCache();
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    clearPasswordCache();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("returns an empty registry when there is no file", async () => {
    const registry = await getPasswords(root);
    expect(registry.passwords).toEqual({});
    expect(registry.file).toBeUndefined();
  });

  it("reads passwords.json from the book root", async () => {
    await write("passwords.json", {
      passwords: { "chapter-3": { value: "kepler", description: "Ch. 3" } },
    });

    const registry = await getPasswords(root);
    expect(registry.passwords["chapter-3"].value).toBe("kepler");
    expect(registry.passwords["chapter-3"].description).toBe("Ch. 3");
    expect(registry.sources["chapter-3"]).toBe("file");
  });

  it("accepts the shorthand string form", async () => {
    await write("passwords.json", { passwords: { solutions: "abc" } });
    const registry = await getPasswords(root);
    expect(registry.passwords.solutions.value).toBe("abc");
  });

  it("honours protect.passwordsFile", async () => {
    await write("secrets.json", { passwords: { solutions: "abc" } });
    const registry = await getPasswords(root, {
      protect: { passwordsFile: "secrets.json" },
    });
    expect(registry.passwords.solutions.value).toBe("abc");
  });

  it("lets HYPERBOOK_PASSWORDS_FILE override the file", async () => {
    await write("passwords.json", { passwords: { solutions: "from-file" } });
    const elsewhere = path.join(root, "elsewhere.json");
    await fs.writeFile(
      elsewhere,
      JSON.stringify({ passwords: { solutions: "from-env-file" } }),
    );
    process.env.HYPERBOOK_PASSWORDS_FILE = elsewhere;

    const registry = await getPasswords(root);
    expect(registry.passwords.solutions.value).toBe("from-env-file");
  });

  it("lets inline HYPERBOOK_PASSWORDS override a file", async () => {
    await write("passwords.json", { passwords: { solutions: "from-file" } });
    process.env.HYPERBOOK_PASSWORDS = JSON.stringify({
      passwords: { solutions: "from-inline" },
    });

    const registry = await getPasswords(root);
    expect(registry.passwords.solutions.value).toBe("from-inline");
    expect(registry.sources.solutions).toBe("env");
  });

  it("lets a per-key variable win over everything", async () => {
    await write("passwords.json", {
      passwords: { "chapter-3": "from-file", solutions: "untouched" },
    });
    process.env.HYPERBOOK_PASSWORD_CHAPTER_3 = "from-env";

    const registry = await getPasswords(root);
    expect(registry.passwords["chapter-3"].value).toBe("from-env");
    expect(registry.sources["chapter-3"]).toBe("env");
    expect(registry.passwords.solutions.value).toBe("untouched");
  });

  it("resolves a referenced key that only exists in the environment", async () => {
    process.env.HYPERBOOK_PASSWORD_SOLUTIONS = "from-env";

    const registry = withReferencedKeys(await getPasswords(root), [
      "solutions",
      "missing",
    ]);
    expect(registry.passwords.solutions.value).toBe("from-env");
    // A key with no value anywhere stays unresolved rather than becoming "".
    expect(registry.passwords.missing).toBeUndefined();
  });

  it("throws on a malformed registry rather than silently ignoring it", async () => {
    await fs.writeFile(path.join(root, "passwords.json"), "{ not json");
    await expect(getPasswords(root)).rejects.toThrow(/Could not parse/);
  });

  it("throws when the passwords key is missing", async () => {
    await write("passwords.json", { chapter: "oops" });
    await expect(getPasswords(root)).rejects.toThrow(/needs a "passwords"/);
  });
});
