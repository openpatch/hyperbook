import chalk from "chalk";
import crypto from "node:crypto";
import fs from "fs/promises";
import path from "path";
import {
  collectPasswords,
  CollectedPassword,
  PasswordReport,
} from "@hyperbook/markdown";
import {
  vfile,
  hyperproject,
  DEFAULT_PASSWORDS_FILE,
  envVarFor,
} from "@hyperbook/fs";
import { Hyperproject, PasswordsJson } from "@hyperbook/types";

type Book = { root: string; name: string };

/**
 * Every book in the project. A hyperlibrary holds several, each with its own
 * registry, so all three subcommands iterate rather than assuming one book.
 */
const getBooks = (project: Hyperproject): Book[] => {
  if (project.type === "book") {
    return [{ root: project.src, name: hyperproject.getName(project) }];
  }
  return project.projects.flatMap(getBooks);
};

const prefix = (name: string) => `${chalk.blue(`[${name}]`)}`;

const location = (entry: CollectedPassword): string => {
  if (entry.file) {
    return entry.line ? `${entry.file}:${entry.line}` : entry.file;
  }
  return entry.href || "";
};

const label = (entry: CollectedPassword): string => {
  const parts: string[] = [entry.type];
  if (entry.inherited) parts.push("inherited");
  return parts.join(", ");
};

const printTable = (rows: string[][]) => {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => row[i].length)),
  );
  rows.forEach((row, index) => {
    const line = row
      .map((cell, i) => cell.padEnd(i === row.length - 1 ? 0 : widths[i]))
      .join("  ");
    console.log(index === 0 ? chalk.bold(line) : line);
  });
};

const filterEntries = (
  report: PasswordReport,
  options: { type?: string; filter?: string },
): CollectedPassword[] => {
  let entries = report.entries;

  if (options.type) {
    const types = options.type.split(",").map((t) => t.trim());
    entries = entries.filter((e) => types.includes(e.type));
  }

  if (options.filter) {
    const re = new RegExp(options.filter);
    entries = entries.filter((e) =>
      [e.key, e.href, e.file, e.description, e.name]
        .filter(Boolean)
        .some((value) => re.test(value as string)),
    );
  }

  return entries;
};

export async function runPasswordsList(
  project: Hyperproject,
  options: { json?: boolean; type?: string; filter?: string },
): Promise<void> {
  const books = getBooks(project);
  const output: Record<string, CollectedPassword[]> = {};

  for (const book of books) {
    const report = await collectPasswords(book.root, { reload: true });
    const entries = filterEntries(report, options);

    if (options.json) {
      output[book.name] = entries;
      continue;
    }

    console.log(`${prefix(book.name)} ${book.root}`);
    if (report.registryFile) {
      console.log(
        `${prefix(book.name)} Registry: ${path.relative(book.root, report.registryFile)}`,
      );
    }

    if (entries.length === 0) {
      console.log(`${prefix(book.name)} No passwords found.`);
      console.log();
      continue;
    }

    printTable([
      ["KEY", "PASSWORD", "SOURCE", "WHERE", "LOCATION", "DESCRIPTION"],
      ...entries.map((e) => [
        e.key || "-",
        e.password ?? chalk.red("<missing>"),
        e.resolvedFrom || "-",
        label(e),
        location(e),
        e.description || e.name || "",
      ]),
    ]);
    console.log();
  }

  if (options.json) {
    console.log(JSON.stringify(books.length === 1 ? Object.values(output)[0] : output, null, 2));
  }
}

/** Readable random password: no ambiguous characters, grouped for dictation. */
const generatePassword = (): string => {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const pick = (n: number) =>
    Array.from(
      crypto.randomBytes(n),
      (byte) => alphabet[byte % alphabet.length],
    ).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
};

export async function runPasswordsInit(
  project: Hyperproject,
  options: { file?: string; generate?: boolean; force?: boolean },
): Promise<void> {
  const books = getBooks(project);

  for (const book of books) {
    const config = await vfile.getJson(book.root).catch(() => undefined);
    const fileName =
      options.file || config?.protect?.passwordsFile || DEFAULT_PASSWORDS_FILE;
    const target = path.isAbsolute(fileName)
      ? fileName
      : path.join(book.root, fileName);

    const report = await collectPasswords(book.root, { reload: true });
    const referenced = [
      ...new Set(
        report.entries
          .filter((e) => e.type !== "registry")
          .map((e) => e.key)
          .filter((k): k is string => Boolean(k)),
      ),
    ].sort();

    // Merge rather than overwrite: the file holds real passwords, and losing
    // them would lock everyone out of already published content.
    let existing: PasswordsJson = { passwords: {} };
    let existed = false;
    try {
      existing = JSON.parse(await fs.readFile(target, "utf-8"));
      existing.passwords = existing.passwords || {};
      existed = true;
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }

    const next: PasswordsJson = {
      $schema: existing.$schema,
      passwords: { ...existing.passwords },
    };

    let added = 0;
    let filled = 0;
    for (const key of referenced) {
      const current = next.passwords[key];
      const value = typeof current === "string" ? current : current?.value;

      if (value && !options.force) continue;
      if (!current) added++;
      else filled++;

      next.passwords[key] = {
        ...(typeof current === "object" ? current : {}),
        value: options.generate ? generatePassword() : value || "",
      };
    }

    await fs.writeFile(target, JSON.stringify(next, null, 2) + "\n");

    const relative = path.relative(book.root, target);
    console.log(
      `${prefix(book.name)} ${existed ? "Updated" : "Created"} ${relative} (${added} added, ${filled} rewritten).`,
    );

    const empty = Object.entries(next.passwords).filter(
      ([, entry]) => !(typeof entry === "string" ? entry : entry.value),
    );
    if (empty.length > 0) {
      console.log(
        `${prefix(book.name)} ${chalk.yellow("Still empty:")} ${empty.map(([k]) => k).join(", ")}`,
      );
      console.log(
        `${prefix(book.name)} Fill them in, or re-run with --generate.`,
      );
    }

    if (!(await isIgnored(book.root, relative))) {
      console.log(
        `${prefix(book.name)} ${chalk.yellow("Note:")} ${relative} holds real passwords. Add it to .gitignore if this book is public.`,
      );
    }
  }
}

const isIgnored = async (root: string, relative: string): Promise<boolean> => {
  try {
    const ignore = await fs.readFile(path.join(root, ".gitignore"), "utf-8");
    return ignore
      .split("\n")
      .map((line) => line.trim())
      .includes(relative);
  } catch {
    return false;
  }
};

export async function runPasswordsCheck(
  project: Hyperproject,
  options: { json?: boolean },
): Promise<boolean> {
  const books = getBooks(project);
  const report: Record<string, unknown> = {};
  let ok = true;

  for (const book of books) {
    const result = await collectPasswords(book.root, { reload: true });

    if (options.json) {
      report[book.name] = {
        missing: result.missing,
        unused: result.unused,
        duplicates: result.duplicates,
      };
      if (result.missing.length > 0) ok = false;
      continue;
    }

    if (result.missing.length > 0) {
      ok = false;
      console.log(
        `${prefix(book.name)} ${chalk.red(`${result.missing.length} password(s) missing:`)}`,
      );
      for (const entry of result.missing) {
        console.log(
          `  ${chalk.red(entry.key)} used by ${label(entry)} ${location(entry)}`,
        );
        console.log(`    set ${envVarFor(entry.key!)} or add it to the registry`);
      }
    } else {
      console.log(`${prefix(book.name)} ${chalk.green("All passwords resolve.")}`);
    }

    // Warnings, not failures: neither breaks a build.
    if (result.unused.length > 0) {
      console.log(
        `${prefix(book.name)} ${chalk.yellow("Unused registry keys:")} ${result.unused.join(", ")}`,
      );
    }
    for (const group of result.duplicates) {
      console.log(
        `${prefix(book.name)} ${chalk.yellow("Same password shared by:")} ${group.join(", ")}`,
      );
    }
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  }

  return ok;
}
