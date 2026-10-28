import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { backup } from "../src/server/backup";
import { loadConfig } from "../src/server/config";
import { migrateDb, openDb } from "../src/server/db/client";
import { books } from "../src/server/db/schema";
import { commitChanges, headCommit, initRepo } from "../src/server/hosting/git";
import { buildDir, repoDir } from "../src/server/hosting/storage";
import { dataDirs } from "./helpers";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const who = { name: "Ada", email: "ada@example.org" };

describe("backup", () => {
  it("copies the database and the books' repositories, not their builds", async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), "cloud-backup-"));
    dataDirs.push(dataDir);
    const config = loadConfig({ NODE_ENV: "test", DATA_DIR: dataDir });
    const file = path.join(dataDir, "database.sqlite");
    const { db, sqlite } = openDb(file);
    migrateDb(sqlite, db, { migrationsFolder, file });
    const book = db.insert(books).values({ slug: "physics", title: "Physics" }).returning().get();
    const repo = repoDir(config, book.id);
    await initRepo(repo);
    const { commit } = await commitChanges(
      repo,
      [{ op: "write", path: "hyperbook.json", content: Buffer.from("{}"), baseOid: null }],
      { message: "Start", author: who, committer: who, maxBytes: 1e6 },
    );
    const build = buildDir(config, book.id, 1);
    (await import("node:fs")).mkdirSync(build, { recursive: true });
    writeFileSync(path.join(build, "index.html"), "built");

    const target = path.join(mkdtempSync(path.join(os.tmpdir(), "cloud-backup-to-")), "copy");
    const result = await backup(config, target);
    expect(result.books).toBe(1);

    const copy = new Database(path.join(target, "database.sqlite"), { readonly: true });
    expect(copy.prepare("select slug from books").all()).toEqual([{ slug: "physics" }]);
    copy.close();
    expect(await headCommit(path.join(target, "books", String(book.id), "repo.git"))).toBe(commit);
    expect(existsSync(path.join(target, "books", String(book.id), "builds"))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(target, "backup.json"), "utf8")).books).toBe(1);

    // Never into a folder that holds something.
    await expect(backup(config, target)).rejects.toThrow(/not empty/);
    sqlite.close();
  });
});
