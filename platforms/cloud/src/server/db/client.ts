import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = ReturnType<typeof openDb>["db"];

/**
 * Opens (or creates) the database. ":memory:" gives a throwaway database for
 * tests.
 */
export function openDb(file: string) {
  const sqlite = new Database(file);
  // WAL lets reads continue while a write is in progress.
  if (file !== ":memory:") sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/**
 * Applies pending migrations. Before changing an existing database it writes a
 * copy next to it, so a failed upgrade can be undone by hand.
 */
export function migrateDb(
  sqlite: Database.Database,
  db: Db,
  options: { migrationsFolder: string; file: string },
): { applied: number; backup: string | null } {
  const pending = pendingMigrations(sqlite, options.migrationsFolder);
  if (pending === 0) return { applied: 0, backup: null };

  let backup: string | null = null;
  if (options.file !== ":memory:" && hasTables(sqlite)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = path.join(
      path.dirname(options.file),
      `${path.basename(options.file, ".sqlite")}.before-migration-${stamp}.sqlite`,
    );
    sqlite.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  }

  migrate(db, { migrationsFolder: options.migrationsFolder });
  return { applied: pending, backup };
}

function hasTables(sqlite: Database.Database): boolean {
  const row = sqlite
    .prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
    )
    .get() as { n: number };
  return row.n > 0;
}

function pendingMigrations(
  sqlite: Database.Database,
  migrationsFolder: string,
): number {
  const journalFile = path.join(migrationsFolder, "meta", "_journal.json");
  if (!existsSync(journalFile)) {
    throw new Error(`No migrations found at ${migrationsFolder}`);
  }
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
    entries: unknown[];
  };
  const tracked = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    )
    .get();
  if (!tracked) return journal.entries.length;
  const row = sqlite
    .prepare("SELECT count(*) AS n FROM __drizzle_migrations")
    .get() as { n: number };
  return journal.entries.length - row.n;
}
