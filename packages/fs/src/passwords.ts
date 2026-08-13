import fs from "fs/promises";
import path from "path";
import {
  HyperbookJson,
  PasswordEntry,
  PasswordsJson,
} from "@hyperbook/types";

export type PasswordRegistry = Record<string, PasswordEntry>;

/** Where a password ended up coming from, for `hyperbook passwords list`. */
export type PasswordSource = "file" | "env";

export type ResolvedRegistry = {
  passwords: PasswordRegistry;
  sources: Record<string, PasswordSource>;
  /** Absolute path of the registry file that was read, if any. */
  file?: string;
};

export const DEFAULT_PASSWORDS_FILE = "passwords.json";

const ENV_PREFIX = "HYPERBOOK_PASSWORD_";

/**
 * Environment variable that overrides a single registry key.
 * `chapter-3` becomes `HYPERBOOK_PASSWORD_CHAPTER_3`.
 */
export const envVarFor = (key: string): string =>
  ENV_PREFIX + key.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();

const parseRegistry = (raw: string, where: string): PasswordRegistry => {
  let parsed: PasswordsJson;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse the password registry in ${where}: ${e}`);
  }

  const passwords = parsed?.passwords;
  if (!passwords || typeof passwords !== "object") {
    throw new Error(
      `The password registry in ${where} needs a "passwords" object.`,
    );
  }

  // Accept the shorthand `"key": "value"` alongside the full object form.
  const normalized: PasswordRegistry = {};
  for (const [key, entry] of Object.entries(passwords)) {
    normalized[key] =
      typeof entry === "string" ? { value: entry } : (entry as PasswordEntry);
  }
  return normalized;
};

const cache = new Map<string, ResolvedRegistry>();

/**
 * Loads the password registry for a book.
 *
 * Passwords are kept out of hyperbook.json on purpose: that file is committed
 * and often published, so it is the wrong place for secrets. The registry file
 * can be gitignored and supplied by the environment instead.
 *
 * Later sources win:
 *   1. `protect.passwordsFile`, else `passwords.json` in the book root.
 *      A missing file is not an error — a book may define every password inline.
 *   2. `HYPERBOOK_PASSWORDS_FILE`, a registry file elsewhere on disk.
 *   3. `HYPERBOOK_PASSWORDS`, the registry JSON inline, for CI secrets.
 *   4. `HYPERBOOK_PASSWORD_<KEY>`, a single key, so CI can inject one password
 *      without maintaining a file.
 */
export const getPasswords = async (
  root: string,
  config?: Pick<HyperbookJson, "protect">,
  { reload = false }: { reload?: boolean } = {},
): Promise<ResolvedRegistry> => {
  if (!reload && cache.has(root)) {
    return cache.get(root)!;
  }

  const passwords: PasswordRegistry = {};
  const sources: Record<string, PasswordSource> = {};
  let file: string | undefined;

  const assign = (entries: PasswordRegistry, source: PasswordSource) => {
    for (const [key, entry] of Object.entries(entries)) {
      passwords[key] = entry;
      sources[key] = source;
    }
  };

  const fileName = config?.protect?.passwordsFile || DEFAULT_PASSWORDS_FILE;
  const filePath = path.isAbsolute(fileName)
    ? fileName
    : path.join(root, fileName);
  try {
    assign(parseRegistry(await fs.readFile(filePath, "utf-8"), fileName), "file");
    file = filePath;
  } catch (e: any) {
    // Only a missing file is tolerated; a malformed one is a real error.
    if (e?.code !== "ENOENT") throw e;
  }

  const envFile = process.env.HYPERBOOK_PASSWORDS_FILE;
  if (envFile) {
    assign(
      parseRegistry(
        await fs.readFile(envFile, "utf-8"),
        "HYPERBOOK_PASSWORDS_FILE",
      ),
      "file",
    );
    file = path.resolve(envFile);
  }

  const envInline = process.env.HYPERBOOK_PASSWORDS;
  if (envInline) {
    assign(parseRegistry(envInline, "HYPERBOOK_PASSWORDS"), "env");
  }

  // Per-key overrides. These can only fill keys the book already references,
  // because there is no way to recover the original key from the variable name
  // (`chapter-3` and `chapter_3` both map to CHAPTER_3).
  for (const key of Object.keys(passwords)) {
    const value = process.env[envVarFor(key)];
    if (value !== undefined) {
      passwords[key] = { ...passwords[key], value };
      sources[key] = "env";
    }
  }

  const resolved: ResolvedRegistry = { passwords, sources, file };
  cache.set(root, resolved);
  return resolved;
};

/**
 * Adds keys the book references but the registry does not define, so callers
 * can apply `HYPERBOOK_PASSWORD_<KEY>` to them and report the rest as missing.
 */
export const withReferencedKeys = (
  registry: ResolvedRegistry,
  keys: string[],
): ResolvedRegistry => {
  const passwords = { ...registry.passwords };
  const sources = { ...registry.sources };

  for (const key of keys) {
    if (passwords[key]?.value) continue;
    const value = process.env[envVarFor(key)];
    if (value !== undefined) {
      passwords[key] = { ...passwords[key], value };
      sources[key] = "env";
    }
  }

  return { ...registry, passwords, sources };
};

/** Drops the cache, so the dev server picks up an edited registry. */
export const clearPasswordCache = (root?: string) => {
  if (root) cache.delete(root);
  else cache.clear();
};
