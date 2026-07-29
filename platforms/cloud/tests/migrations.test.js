import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import migrations from "../lib/migrations.js";

// Upgrades are the moment a self-hosted install is most likely to lose data,
// so the guarantees here are: run each step once, in order; never run against a
// database a newer build already wrote; and always leave a copy behind first.

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-migrations-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A database on disk, so backups have something real to copy. */
function onDisk(name = "test.sqlite") {
  return new Database(path.join(dir, name));
}

function backupsIn() {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".backup"));
}

function tablesOf(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
}

describe("applying migrations", () => {
  it("builds the whole schema on a fresh database", () => {
    const db = new Database(":memory:");

    const result = migrations.migrate(db);

    expect(result.from).toBe(0);
    expect(result.to).toBe(migrations.LATEST_VERSION);
    expect(tablesOf(db)).toEqual(
      expect.arrayContaining([
        "hyperbooks",
        "groups",
        "users",
        "events",
        "snapshots",
        "permissions",
      ]),
    );
  });

  it("records the version it reached", () => {
    const db = new Database(":memory:");
    migrations.migrate(db);

    expect(migrations.getVersion(db)).toBe(migrations.LATEST_VERSION);
  });

  it("does nothing the second time", () => {
    const db = new Database(":memory:");
    migrations.migrate(db);

    const again = migrations.migrate(db);

    expect(again.applied).toEqual([]);
    expect(again.from).toBe(migrations.LATEST_VERSION);
  });

  it("leaves existing rows alone when re-run", () => {
    const db = new Database(":memory:");
    migrations.migrate(db);
    db.prepare("INSERT INTO hyperbooks (slug, name) VALUES ('a', 'A')").run();

    migrations.migrate(db);

    expect(db.prepare("SELECT COUNT(*) c FROM hyperbooks").get().c).toBe(1);
  });
});

describe("refusing a downgrade", () => {
  it("will not open a database written by a newer build", () => {
    // Otherwise an older server silently reads a schema it does not know,
    // which is far worse than not starting.
    const db = new Database(":memory:");
    migrations.migrate(db);
    db.pragma(`user_version = ${migrations.LATEST_VERSION + 5}`);

    expect(() => migrations.migrate(db)).toThrow(/older Hyperbook Cloud/);
  });

  it("names both versions so the operator knows what to install", () => {
    const db = new Database(":memory:");
    db.pragma("user_version = 99");

    expect(() => migrations.migrate(db)).toThrow(/version 99/);
  });
});

describe("backups", () => {
  it("copies the database before upgrading one that has content", () => {
    const db = onDisk();
    db.exec("CREATE TABLE legacy (id INTEGER PRIMARY KEY)");
    db.prepare("INSERT INTO legacy (id) VALUES (1)").run();

    const result = migrations.migrate(db);

    expect(result.backup).not.toBeNull();
    expect(backupsIn()).toHaveLength(1);

    const restored = new Database(result.backup, { readonly: true });
    expect(restored.prepare("SELECT COUNT(*) c FROM legacy").get().c).toBe(1);
    restored.close();
  });

  it("does not back up a first run, which has nothing to lose", () => {
    const db = onDisk();

    const result = migrations.migrate(db);

    expect(result.backup).toBeNull();
    expect(backupsIn()).toEqual([]);
  });

  it("does not back up when there is nothing to migrate", () => {
    const db = onDisk();
    migrations.migrate(db);

    migrations.migrate(db);

    expect(backupsIn()).toEqual([]);
  });

  it("keeps only the most recent backups", () => {
    const db = onDisk();
    db.exec("CREATE TABLE legacy (id INTEGER PRIMARY KEY)");

    // Stand in for backups left by earlier upgrades.
    for (const stamp of ["2020", "2021", "2022", "2023"]) {
      fs.writeFileSync(path.join(dir, `test.sqlite.v0-${stamp}.backup`), "x");
    }

    migrations.migrate(db, { keepBackups: 2 });

    expect(backupsIn()).toHaveLength(2);
  });

  it("refuses to migrate if the backup cannot be written", () => {
    const db = onDisk();
    db.exec("CREATE TABLE legacy (id INTEGER PRIMARY KEY)");
    fs.chmodSync(dir, 0o500); // read and traverse, but no new files

    try {
      expect(() => migrations.migrate(db)).toThrow(/could not back up/);
      expect(migrations.getVersion(db)).toBe(0);
    } finally {
      fs.chmodSync(dir, 0o700);
    }
  });

  it("can be turned off", () => {
    const db = onDisk();
    db.exec("CREATE TABLE legacy (id INTEGER PRIMARY KEY)");

    migrations.migrate(db, { backups: false });

    expect(backupsIn()).toEqual([]);
  });
});

describe("upgrading a database from an earlier release", () => {
  /** The schema as it shipped before event sourcing. */
  function legacyDatabase() {
    const db = onDisk();
    db.exec(`
      CREATE TABLE hyperbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hyperbook_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
        group_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        hyperbook_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare("INSERT INTO hyperbooks (slug, name) VALUES ('b', 'B')").run();
    db.prepare(
      "INSERT INTO users (username, password, role) VALUES ('s1', 'pw', 'student')",
    ).run();
    db.prepare(
      "INSERT INTO stores (user_id, hyperbook_id, data) VALUES (1, 1, '{\"v\":1}')",
    ).run();
    return db;
  }

  it("adds the teacher role and email without dropping users", () => {
    const db = legacyDatabase();

    migrations.migrate(db);

    const columns = db
      .prepare("PRAGMA table_info(users)")
      .all()
      .map((c) => c.name);
    expect(columns).toContain("email");
    expect(db.prepare("SELECT username FROM users").all()).toEqual([
      { username: "s1" },
    ]);

    // The widened CHECK constraint has to actually accept a teacher.
    expect(() =>
      db
        .prepare(
          "INSERT INTO users (username, password, role) VALUES ('t1', 'pw', 'teacher')",
        )
        .run(),
    ).not.toThrow();
  });

  it("folds the retired stores table into snapshots", () => {
    const db = legacyDatabase();

    migrations.migrate(db);

    expect(tablesOf(db)).not.toContain("stores");
    const snapshots = db.prepare("SELECT * FROM snapshots").all();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].data).toBe('{"v":1}');
  });

  it("takes a backup of the pre-upgrade database", () => {
    const db = legacyDatabase();

    const result = migrations.migrate(db);

    const restored = new Database(result.backup, { readonly: true });
    expect(restored.prepare("SELECT COUNT(*) c FROM stores").get().c).toBe(1);
    restored.close();
  });

  it("adds the event columns a pre-versioning install is missing", () => {
    const db = onDisk();
    db.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        hyperbook_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('create','update','delete')),
        prim_key TEXT NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare(
      "INSERT INTO events (user_id, hyperbook_id, table_name, operation, prim_key, data) " +
        "VALUES (1, 1, 'consent', 'create', '1', '{\"id\":1}')",
    ).run();

    migrations.migrate(db);

    const columns = db
      .prepare("PRAGMA table_info(events)")
      .all()
      .map((c) => c.name);
    expect(columns).toEqual(
      expect.arrayContaining(["prim_key_json", "table_schema"]),
    );
    expect(db.prepare("SELECT COUNT(*) c FROM events").get().c).toBe(1);
  });
});
