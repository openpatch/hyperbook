import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Config } from "./config";
import { hyperbookVersion } from "./hosting/runner";
import { repoDir } from "./hosting/storage";

import { typstLibrary } from "./hosting/typst";

/*
 * `node dist/server/main.js backup <dir>`: a consistent copy of an instance
 * while it runs.
 *
 *   <dir>/database.sqlite        SQLite's online backup of the database
 *   <dir>/books/<id>/repo.git/   every book's repository (its source)
 *   <dir>/typst/library/         the shared Typst packages admins uploaded
 *   <dir>/backup.json            when, and with which version
 *
 * Builds are left out: after a restore the platform rebuilds published books
 * whose build is missing. So are Typst's binaries, its package cache and the
 * compile caches (DATA_DIR/typst), which come back on first use. CREDENTIALS_KEY is not in the data and has to be
 * kept separately.
 */

export async function backup(config: Config, target: string) {
  const dest = path.resolve(target);
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    throw new Error(`${dest} is not empty; back up into a new or empty folder`);
  }
  mkdirSync(path.join(dest, "books"), { recursive: true });

  const source = new Database(path.join(config.dataDir, "database.sqlite"), { readonly: true, fileMustExist: true });
  try {
    await source.backup(path.join(dest, "database.sqlite"));
  } finally {
    source.close();
  }

  const booksRoot = path.join(config.dataDir, "books");
  let books = 0;
  for (const id of existsSync(booksRoot) ? readdirSync(booksRoot) : []) {
    const repo = repoDir(config, Number(id));
    if (!/^\d+$/.test(id) || !existsSync(repo)) continue;
    const copy = path.join(dest, "books", id, "repo.git");
    // Refs before objects: objects are never changed, only added, so every
    // commit the copied refs name is copied, too, even if someone saves now.
    for (const entry of readdirSync(repo).sort((a, b) => Number(a === "objects") - Number(b === "objects"))) {
      cpSync(path.join(repo, entry), path.join(copy, entry), { recursive: true });
    }
    books++;
  }

  // Uploaded, not downloaded: it cannot come back on its own.
  const library = typstLibrary(config);
  if (existsSync(library)) cpSync(library, path.join(dest, "typst", "library"), { recursive: true });

  writeFileSync(
    path.join(dest, "backup.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), hyperbook: hyperbookVersion(config), books }, null, 2) + "\n",
  );
  return { dest, books };
}
