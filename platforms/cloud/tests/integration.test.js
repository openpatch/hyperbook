import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";

// Set up an in-memory database before importing db.js
// We need to override the DATABASE_PATH env var
process.env.DATABASE_PATH = ":memory:";

// We can't import db.js directly because it opens the DB at module load.
// Instead, replicate the DB setup and functions inline for integration testing.

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS hyperbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hyperbook_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE,
      UNIQUE(hyperbook_id, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'student', 'teacher')),
      group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hyperbook_id INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      prim_key TEXT NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hyperbook_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      last_event_id INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE
    )
  `);

  // Seed test data
  db.prepare(
    "INSERT INTO hyperbooks (slug, name) VALUES ('test', 'Test Hyperbook')",
  ).run();
  db.prepare(
    "INSERT INTO groups (hyperbook_id, name) VALUES (1, 'Test Group')",
  ).run();
  db.prepare(
    "INSERT INTO users (username, password, role, group_id) VALUES ('student1', 'pass', 'student', 1)",
  ).run();

  return db;
}

// === Replicate the event-sourcing functions from db.js ===

function applyEventsToSnapshot(snapshotData, events) {
  if (!events || events.length === 0) return snapshotData;

  var dexieData =
    snapshotData.data && snapshotData.data.hyperbook
      ? snapshotData.data.hyperbook.data
      : snapshotData.data;
  var tables = dexieData && dexieData.tables ? dexieData.tables : [];
  if (dexieData && !dexieData.tables) {
    dexieData.tables = tables;
  }
  var tableMap = {};
  for (var t = 0; t < tables.length; t++) {
    tableMap[tables[t].name] = tables[t];
  }

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var tableName = evt.table_name;
    var data = evt.data ? JSON.parse(evt.data) : null;

    if (!tableMap[tableName]) {
      var newTable = { name: tableName, schema: "id", rowCount: 0, rows: [] };
      tables.push(newTable);
      tableMap[tableName] = newTable;
    }

    var table = tableMap[tableName];
    if (!table.rows) table.rows = [];
    var pkField = table.schema ? table.schema.split(",")[0].trim() : "id";

    if (evt.operation === "create") {
      table.rows.push(data);
    } else if (evt.operation === "update") {
      var found = false;
      for (var r = 0; r < table.rows.length; r++) {
        if (String(table.rows[r][pkField]) === evt.prim_key) {
          var keys = Object.keys(data);
          for (var k = 0; k < keys.length; k++) {
            table.rows[r][keys[k]] = data[keys[k]];
          }
          found = true;
          break;
        }
      }
      if (!found && data) {
        data[pkField] = evt.prim_key;
        table.rows.push(data);
      }
    } else if (evt.operation === "delete") {
      for (var d = 0; d < table.rows.length; d++) {
        if (String(table.rows[d][pkField]) === evt.prim_key) {
          table.rows.splice(d, 1);
          break;
        }
      }
    }

    table.rowCount = table.rows.length;
  }

  return snapshotData;
}

function makeHelpers(db) {
  function getLatestSnapshot(userId, hyperbookId) {
    return db
      .prepare(
        "SELECT id, data, last_event_id, created_at FROM snapshots " +
          "WHERE user_id = ? AND hyperbook_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(userId, hyperbookId);
  }

  function getEventsSince(userId, hyperbookId, afterEventId) {
    return db
      .prepare(
        "SELECT id, table_name, operation, prim_key, data, created_at FROM events " +
          "WHERE user_id = ? AND hyperbook_id = ? AND id > ? ORDER BY id ASC",
      )
      .all(userId, hyperbookId, afterEventId);
  }

  function getLatestEventId(userId, hyperbookId) {
    var row = db
      .prepare(
        "SELECT MAX(id) as max_id FROM events WHERE user_id = ? AND hyperbook_id = ?",
      )
      .get(userId, hyperbookId);
    return row ? row.max_id || 0 : 0;
  }

  function appendEvents(userId, hyperbookId, events) {
    var stmt = db.prepare(
      "INSERT INTO events (user_id, hyperbook_id, table_name, operation, prim_key, data) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    );

    var insertMany = db.transaction(function (evts) {
      var lastId = 0;
      for (var i = 0; i < evts.length; i++) {
        var evt = evts[i];
        var result = stmt.run(
          userId,
          hyperbookId,
          evt.table,
          evt.op,
          String(evt.primKey),
          evt.data ? JSON.stringify(evt.data) : null,
        );
        lastId = Number(result.lastInsertRowid);
      }
      return lastId;
    });

    return insertMany(events);
  }

  function replaceWithSnapshot(userId, hyperbookId, data) {
    var replaceAll = db.transaction(function () {
      db.prepare(
        "DELETE FROM events WHERE user_id = ? AND hyperbook_id = ?",
      ).run(userId, hyperbookId);
      db.prepare(
        "DELETE FROM snapshots WHERE user_id = ? AND hyperbook_id = ?",
      ).run(userId, hyperbookId);
      var result = db
        .prepare(
          "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id) VALUES (?, ?, ?, 0)",
        )
        .run(userId, hyperbookId, JSON.stringify(data));
      return Number(result.lastInsertRowid);
    });
    return replaceAll();
  }

  function reconstructState(userId, hyperbookId) {
    var snapshot = getLatestSnapshot(userId, hyperbookId);
    var snapshotEventId = snapshot ? snapshot.last_event_id : 0;
    var events = getEventsSince(userId, hyperbookId, snapshotEventId);

    if (!snapshot && events.length === 0) {
      return null;
    }

    var snapshotData = snapshot
      ? JSON.parse(snapshot.data)
      : {
          version: 1,
          data: {
            hyperbook: {
              formatName: "dexie",
              formatVersion: 1,
              data: {
                databaseName: "Hyperbook",
                databaseVersion: 2,
                tables: [],
              },
            },
          },
        };

    var lastEventId =
      events.length > 0 ? events[events.length - 1].id : snapshotEventId;

    var updatedAt =
      events.length > 0
        ? events[events.length - 1].created_at
        : snapshot
          ? snapshot.created_at
          : null;

    if (events.length === 0) {
      return {
        data: snapshotData,
        lastEventId: lastEventId,
        updatedAt: updatedAt,
      };
    }

    var reconstructed = applyEventsToSnapshot(snapshotData, events);

    return {
      data: reconstructed,
      lastEventId: lastEventId,
      updatedAt: updatedAt,
    };
  }

  return {
    getLatestSnapshot,
    getEventsSince,
    getLatestEventId,
    appendEvents,
    replaceWithSnapshot,
    reconstructState,
  };
}

describe("integration: event-sourcing full flow", () => {
  let db;
  let helpers;
  const userId = 1;
  const hyperbookId = 1;

  beforeEach(() => {
    db = createTestDb();
    helpers = makeHelpers(db);
  });

  it("should reconstruct state from events only (no snapshot)", () => {
    // Client sends events via POST /events
    const lastEventId = helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "create",
        primKey: "s1",
        data: { id: "s1", collapsed: false },
      },
      {
        table: "tabs",
        op: "create",
        primKey: "t1",
        data: { id: "t1", active: "tab-a" },
      },
    ]);

    expect(lastEventId).toBe(2);

    // Client does GET /store/test → reconstructState
    const state = helpers.reconstructState(userId, hyperbookId);

    expect(state).not.toBeNull();
    expect(state.lastEventId).toBe(2);

    // Verify the wrapper structure
    expect(state.data.version).toBe(1);
    expect(state.data.data.hyperbook).toBeDefined();

    const tables = state.data.data.hyperbook.data.tables;
    const collapsibles = tables.find((t) => t.name === "collapsibles");
    expect(collapsibles).toBeDefined();
    expect(collapsibles.rows).toHaveLength(1);
    expect(collapsibles.rows[0]).toEqual({ id: "s1", collapsed: false });

    const tabs = tables.find((t) => t.name === "tabs");
    expect(tabs).toBeDefined();
    expect(tabs.rows).toHaveLength(1);
  });

  it("should reconstruct state from snapshot + events", () => {
    // Client sends a full snapshot (via sendSnapshot)
    const snapshotData = {
      version: 1,
      origin: "http://localhost:8080",
      data: {
        hyperbook: {
          formatName: "dexie",
          formatVersion: 1,
          data: {
            databaseName: "Hyperbook",
            databaseVersion: 2,
            tables: [
              {
                name: "collapsibles",
                schema: "id",
                rowCount: 1,
                rows: [{ id: "s1", collapsed: false }],
              },
            ],
          },
        },
      },
    };

    helpers.replaceWithSnapshot(userId, hyperbookId, snapshotData);

    // Then client sends events
    const lastEventId = helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "update",
        primKey: "s1",
        data: { collapsed: true },
      },
      {
        table: "tabs",
        op: "create",
        primKey: "t1",
        data: { id: "t1", active: "x" },
      },
    ]);

    // Reconstruct
    const state = helpers.reconstructState(userId, hyperbookId);

    const tables = state.data.data.hyperbook.data.tables;
    const coll = tables.find((t) => t.name === "collapsibles");
    expect(coll.rows[0].collapsed).toBe(true);

    const tabs = tables.find((t) => t.name === "tabs");
    expect(tabs.rows).toHaveLength(1);
    expect(tabs.rows[0].active).toBe("x");
  });

  it("should simulate full client lifecycle: login → events → reload", () => {
    // 1. User logs in, no data yet
    let state = helpers.reconstructState(userId, hyperbookId);
    expect(state).toBeNull();

    // 2. User interacts → Dexie hooks capture events → client sends batch
    helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "create",
        primKey: "section-intro",
        data: { id: "section-intro", collapsed: false },
      },
    ]);

    // 3. User reloads page → GET /store/test
    state = helpers.reconstructState(userId, hyperbookId);
    expect(state).not.toBeNull();

    // 4. Simulate what loadFromCloud does:
    //    const storeData = data.snapshot.data || data.snapshot;
    //    const { hyperbook } = storeData;
    const apiResponse = {
      snapshot: state.data,
      lastEventId: state.lastEventId,
    };
    const storeData = apiResponse.snapshot.data || apiResponse.snapshot;
    const hyperbook = storeData.hyperbook;

    expect(hyperbook).toBeDefined();
    expect(hyperbook.data.tables).toBeDefined();

    const coll = hyperbook.data.tables.find(
      (t) => t.name === "collapsibles",
    );
    expect(coll).toBeDefined();
    expect(coll.rows).toHaveLength(1);
    expect(coll.rows[0].id).toBe("section-intro");
    expect(coll.rows[0].collapsed).toBe(false);
  });

  it("should handle events after reload (second batch)", () => {
    // First batch
    const firstBatchLastId = helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "create",
        primKey: "s1",
        data: { id: "s1", collapsed: false },
      },
    ]);

    // Reload → reconstruct
    let state = helpers.reconstructState(userId, hyperbookId);
    expect(state.lastEventId).toBe(firstBatchLastId);

    // Second batch (simulating afterEventId check)
    const serverLatest = helpers.getLatestEventId(userId, hyperbookId);
    expect(serverLatest).toBe(firstBatchLastId);

    // Client sends second batch
    helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "update",
        primKey: "s1",
        data: { collapsed: true },
      },
    ]);

    // Second reload
    state = helpers.reconstructState(userId, hyperbookId);
    const tables = state.data.data.hyperbook.data.tables;
    const coll = tables.find((t) => t.name === "collapsibles");
    expect(coll.rows[0].collapsed).toBe(true);
  });

  it("should handle replaceWithSnapshot correctly", () => {
    // Some events exist
    helpers.appendEvents(userId, hyperbookId, [
      {
        table: "collapsibles",
        op: "create",
        primKey: "s1",
        data: { id: "s1" },
      },
    ]);

    // Client does full snapshot (import or fallback)
    const snapshotData = {
      version: 1,
      origin: "http://localhost:8080",
      data: {
        hyperbook: {
          formatName: "dexie",
          formatVersion: 1,
          data: {
            databaseName: "Hyperbook",
            databaseVersion: 2,
            tables: [
              {
                name: "tabs",
                schema: "id,active",
                rowCount: 1,
                rows: [{ id: "t1", active: "a" }],
              },
            ],
          },
        },
      },
    };

    helpers.replaceWithSnapshot(userId, hyperbookId, snapshotData);

    // Reconstruct — should only have the snapshot data, no old events
    const state = helpers.reconstructState(userId, hyperbookId);
    const tables = state.data.data.hyperbook.data.tables;

    // collapsibles should NOT exist (it was in events, not snapshot)
    const coll = tables.find((t) => t.name === "collapsibles");
    expect(coll).toBeUndefined();

    // tabs should exist from snapshot
    const tabs = tables.find((t) => t.name === "tabs");
    expect(tabs).toBeDefined();
    expect(tabs.rows).toHaveLength(1);
  });

  it("should return null when no data exists", () => {
    const state = helpers.reconstructState(userId, hyperbookId);
    expect(state).toBeNull();
  });

  it("should handle snapshot with no events (just snapshot)", () => {
    const snapshotData = {
      version: 1,
      data: {
        hyperbook: {
          formatName: "dexie",
          formatVersion: 1,
          data: {
            databaseName: "Hyperbook",
            databaseVersion: 2,
            tables: [
              {
                name: "bookmarks",
                schema: "path,label",
                rowCount: 1,
                rows: [{ path: "/p1", label: "P1" }],
              },
            ],
          },
        },
      },
    };

    helpers.replaceWithSnapshot(userId, hyperbookId, snapshotData);

    const state = helpers.reconstructState(userId, hyperbookId);
    const bookmarks = state.data.data.hyperbook.data.tables.find(
      (t) => t.name === "bookmarks",
    );
    expect(bookmarks.rows).toHaveLength(1);
    expect(bookmarks.rows[0].path).toBe("/p1");
  });
});
