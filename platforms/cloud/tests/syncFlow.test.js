import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import db from "../lib/db.js";

// These tests drive the real lib/db.js. The previous suite re-implemented the
// event-sourcing helpers inline, so it could pass while the shipped code was
// broken. db.js opens its sqlite handle lazily and exposes setDatabase() so a
// fresh in-memory database can be injected per test.

const USER_ID = 1;
const HYPERBOOK_ID = 1;

let sqlite;

beforeEach(async () => {
  sqlite = new Database(":memory:");
  db.setDatabase(sqlite);
  await db.initializeDatabase();

  sqlite
    .prepare("INSERT INTO hyperbooks (slug, name) VALUES ('test', 'Test')")
    .run();
  sqlite
    .prepare("INSERT INTO groups (hyperbook_id, name) VALUES (1, 'Group')")
    .run();
  sqlite
    .prepare(
      "INSERT INTO users (username, password, role, group_id) VALUES ('student1', 'x', 'student', 1)",
    )
    .run();
});

afterEach(() => {
  sqlite.close();
});

// ===== Helpers =====

/** Primary-key source strings, as assets/cloud.js reads them off Dexie. */
const SCHEMAS = {
  consent: "id",
  bookmarks: "path",
  typst: "id",
  pyide: "id",
  textinput: "id",
  onlineide: "scriptId",
};

/** A client-side event, in the shape assets/cloud.js puts on the wire. */
function wireEvent(table, op, primKey, data = null) {
  return { table, schema: SCHEMAS[table] ?? "id", op, primKey, data };
}

function rowsOf(state, tableName) {
  const dexie = state.data.data.hyperbook.data;
  if (Array.isArray(dexie.data)) {
    const entry = dexie.data.find((d) => d.tableName === tableName);
    return entry ? entry.rows : undefined;
  }
  const table = dexie.tables.find((t) => t.name === tableName);
  return table ? table.rows : undefined;
}

/** A full-state snapshot body, as sendSnapshot() posts it. */
function snapshotBody(tables) {
  return {
    version: 1,
    origin: "https://example.org",
    data: {
      hyperbook: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "Hyperbook",
          databaseVersion: 5,
          tables: tables.map((t) => ({
            name: t.name,
            schema: t.schema,
            rowCount: (t.rows || []).length,
          })),
          data: tables.map((t) => ({
            tableName: t.name,
            inbound: true,
            rows: t.rows || [],
          })),
        },
      },
    },
  };
}

// ===== Schema =====

describe("schema", () => {
  it("adds prim_key_json to the events table", () => {
    const columns = sqlite
      .prepare("PRAGMA table_info(events)")
      .all()
      .map((c) => c.name);

    expect(columns).toContain("prim_key_json");
  });

  it("is idempotent across repeated initialization", async () => {
    await expect(db.initializeDatabase()).resolves.not.toThrow();

    const columns = sqlite
      .prepare("PRAGMA table_info(events)")
      .all()
      .filter((c) => c.name === "prim_key_json");
    expect(columns).toHaveLength(1);
  });

  it("migrates a legacy events table that predates prim_key_json", async () => {
    const legacy = new Database(":memory:");
    legacy.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        hyperbook_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('create','update','delete')),
        prim_key TEXT NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    legacy
      .prepare(
        "INSERT INTO events (user_id, hyperbook_id, table_name, operation, prim_key, data) " +
          "VALUES (1, 1, 'consent', 'create', '1', '{\"id\":1}')",
      )
      .run();

    db.setDatabase(legacy);
    await db.initializeDatabase();

    const columns = legacy
      .prepare("PRAGMA table_info(events)")
      .all()
      .map((c) => c.name);
    expect(columns).toContain("prim_key_json");
    expect(legacy.prepare("SELECT COUNT(*) c FROM events").get().c).toBe(1);

    legacy.close();
  });
});

// ===== Reconstruction =====

describe("reconstructState", () => {
  it("returns null when the user has nothing stored", async () => {
    expect(await db.reconstructState(USER_ID, HYPERBOOK_ID)).toBeNull();
  });

  it("builds state from events alone", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("bookmarks", "create", "/a", { path: "/a", label: "A" }),
      wireEvent("bookmarks", "create", "/b", { path: "/b", label: "B" }),
    ]);

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);

    expect(rowsOf(state, "bookmarks")).toEqual([
      { path: "/a", label: "A" },
      { path: "/b", label: "B" },
    ]);
    expect(state.lastEventId).toBe(2);
  });

  it("replays events on top of a snapshot", async () => {
    await db.replaceWithSnapshot(
      USER_ID,
      HYPERBOOK_ID,
      snapshotBody([
        { name: "typst", schema: "id,code", rows: [{ id: "t", code: "old" }] },
      ]),
    );
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("typst", "update", "t", { code: "new" }),
    ]);

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);

    expect(rowsOf(state, "typst")).toEqual([{ id: "t", code: "new" }]);
  });

  it("keeps a numeric primary key numeric through a full round trip", async () => {
    // The legacy prim_key column stringifies keys; prim_key_json preserves the
    // type, so the row the client imports still matches its Dexie schema.
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1, accepted: true }),
      wireEvent("consent", "update", 1, { accepted: false }),
    ]);

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);

    expect(rowsOf(state, "consent")).toEqual([{ id: 1, accepted: false }]);
    expect(typeof rowsOf(state, "consent")[0].id).toBe("number");
  });

  it("does not duplicate rows when a batch is appended twice", async () => {
    const batch = [
      wireEvent("pyide", "create", "s1", { id: "s1", script: "print(1)" }),
    ];

    await db.appendEvents(USER_ID, HYPERBOOK_ID, batch);
    await db.appendEvents(USER_ID, HYPERBOOK_ID, batch);

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    expect(rowsOf(state, "pyide")).toHaveLength(1);
  });

  it("scopes state to one user", async () => {
    sqlite
      .prepare(
        "INSERT INTO users (username, password, role, group_id) VALUES ('student2', 'x', 'student', 1)",
      )
      .run();

    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("typst", "create", "mine", { id: "mine", code: "a" }),
    ]);
    await db.appendEvents(2, HYPERBOOK_ID, [
      wireEvent("typst", "create", "theirs", { id: "theirs", code: "b" }),
    ]);

    expect(rowsOf(await db.reconstructState(USER_ID, HYPERBOOK_ID), "typst")).toEqual([
      { id: "mine", code: "a" },
    ]);
    expect(rowsOf(await db.reconstructState(2, HYPERBOOK_ID), "typst")).toEqual([
      { id: "theirs", code: "b" },
    ]);
  });

  it("scopes state to one hyperbook", async () => {
    sqlite
      .prepare("INSERT INTO hyperbooks (slug, name) VALUES ('other', 'Other')")
      .run();

    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("typst", "create", "a", { id: "a", code: "1" }),
    ]);
    await db.appendEvents(USER_ID, 2, [
      wireEvent("typst", "create", "b", { id: "b", code: "2" }),
    ]);

    expect(rowsOf(await db.reconstructState(USER_ID, HYPERBOOK_ID), "typst")).toEqual([
      { id: "a", code: "1" },
    ]);
    expect(rowsOf(await db.reconstructState(USER_ID, 2), "typst")).toEqual([
      { id: "b", code: "2" },
    ]);
  });
});

// ===== Watermark and conflict detection =====

describe("appendEventsIfCurrent", () => {
  it("accepts a batch from an up-to-date client", async () => {
    const result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("consent", "create", 1, { id: 1 })],
      0,
    );

    expect(result.conflict).toBe(false);
    expect(result.lastEventId).toBe(1);
  });

  it("rejects a batch from a stale client and appends nothing", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1 }),
    ]);

    const result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("consent", "update", 1, { accepted: true })],
      0,
    );

    expect(result.conflict).toBe(true);
    expect(result.serverLastEventId).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) c FROM events").get().c).toBe(1);
  });

  it("skips the check when the client sends no watermark", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1 }),
    ]);

    const result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("consent", "update", 1, { accepted: true })],
      undefined,
    );

    expect(result.conflict).toBe(false);
  });

  it("lets exactly one of two concurrent stale writers through", async () => {
    // Both clients start from watermark 0. The check and the insert share one
    // transaction, so the second must observe the first's write.
    const first = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("typst", "create", "a", { id: "a", code: "1" })],
      0,
    );
    const second = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("typst", "create", "b", { id: "b", code: "2" })],
      0,
    );

    expect(first.conflict).toBe(false);
    expect(second.conflict).toBe(true);
    expect(rowsOf(await db.reconstructState(USER_ID, HYPERBOOK_ID), "typst")).toEqual([
      { id: "a", code: "1" },
    ]);
  });

  it("counts a snapshot's watermark, not just the event log", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1 }),
      wireEvent("consent", "update", 1, { accepted: true }),
    ]);
    // An auto-snapshot truncates the log but keeps the watermark.
    await db.createSnapshot(USER_ID, HYPERBOOK_ID, snapshotBody([]), 2);

    expect(await db.getServerLastEventId(USER_ID, HYPERBOOK_ID)).toBe(2);
    expect(
      (await db.appendEventsIfCurrent(USER_ID, HYPERBOOK_ID, [
        wireEvent("consent", "update", 1, { accepted: false }),
      ], 0)).conflict,
    ).toBe(true);
  });

  it("resets the watermark to 0 after a full snapshot overwrite", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1 }),
    ]);
    await db.replaceWithSnapshot(USER_ID, HYPERBOOK_ID, snapshotBody([]));

    expect(await db.getServerLastEventId(USER_ID, HYPERBOOK_ID)).toBe(0);
    expect(
      (await db.appendEventsIfCurrent(USER_ID, HYPERBOOK_ID, [
        wireEvent("consent", "create", 1, { id: 1 }),
      ], 0)).conflict,
    ).toBe(false);
  });
});

// ===== Snapshots =====

describe("snapshots", () => {
  it("replaceWithSnapshot reports the watermark the client must adopt", async () => {
    const result = await db.replaceWithSnapshot(
      USER_ID,
      HYPERBOOK_ID,
      snapshotBody([]),
    );

    expect(result.lastEventId).toBe(0);
    expect(result.snapshotId).toBeGreaterThan(0);
  });

  it("replaceWithSnapshot discards prior events and snapshots", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("typst", "create", "old", { id: "old", code: "gone" }),
    ]);

    await db.replaceWithSnapshot(
      USER_ID,
      HYPERBOOK_ID,
      snapshotBody([
        { name: "typst", schema: "id,code", rows: [{ id: "new", code: "kept" }] },
      ]),
    );

    expect(sqlite.prepare("SELECT COUNT(*) c FROM events").get().c).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) c FROM snapshots").get().c).toBe(1);
    expect(rowsOf(await db.reconstructState(USER_ID, HYPERBOOK_ID), "typst")).toEqual([
      { id: "new", code: "kept" },
    ]);
  });

  it("compacts into a new snapshot once the threshold is crossed", async () => {
    const events = Array.from({ length: db.SNAPSHOT_THRESHOLD }, (_, i) =>
      wireEvent("bookmarks", "create", `/p${i}`, { path: `/p${i}` }),
    );
    await db.appendEvents(USER_ID, HYPERBOOK_ID, events);

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);

    expect(rowsOf(state, "bookmarks")).toHaveLength(db.SNAPSHOT_THRESHOLD);
    expect(sqlite.prepare("SELECT COUNT(*) c FROM events").get().c).toBe(0);

    const snapshot = await db.getLatestSnapshot(USER_ID, HYPERBOOK_ID);
    expect(snapshot.source).toBe("auto");
    expect(snapshot.last_event_id).toBe(db.SNAPSHOT_THRESHOLD);
  });

  it("serves identical state before and after compaction", async () => {
    const events = Array.from({ length: db.SNAPSHOT_THRESHOLD }, (_, i) =>
      wireEvent("bookmarks", "create", `/p${i}`, { path: `/p${i}` }),
    );
    await db.appendEvents(USER_ID, HYPERBOOK_ID, events);

    const before = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    const after = await db.reconstructState(USER_ID, HYPERBOOK_ID);

    expect(rowsOf(after, "bookmarks")).toEqual(rowsOf(before, "bookmarks"));
    expect(after.lastEventId).toBe(before.lastEventId);
  });

  it("keeps the client's watermark valid across compaction", async () => {
    const events = Array.from({ length: db.SNAPSHOT_THRESHOLD }, (_, i) =>
      wireEvent("bookmarks", "create", `/p${i}`, { path: `/p${i}` }),
    );
    const lastEventId = await db.appendEvents(USER_ID, HYPERBOOK_ID, events);

    await db.reconstructState(USER_ID, HYPERBOOK_ID); // triggers compaction

    const result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("bookmarks", "delete", "/p0")],
      lastEventId,
    );

    expect(result.conflict).toBe(false);
  });
});

// ===== Client lifecycle =====

describe("client lifecycle", () => {
  it("survives edit → reload → edit against a moving watermark", async () => {
    // First session.
    let watermark = await db.getServerLastEventId(USER_ID, HYPERBOOK_ID);
    let result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [
        wireEvent("textinput", "create", "q1", { id: "q1", text: "draft" }),
        wireEvent("textinput", "update", "q1", { text: "final" }),
      ],
      watermark,
    );
    expect(result.conflict).toBe(false);
    watermark = result.lastEventId;

    // Reload: the client adopts the watermark the GET reports.
    const loaded = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    expect(rowsOf(loaded, "textinput")).toEqual([{ id: "q1", text: "final" }]);
    expect(loaded.lastEventId).toBe(watermark);

    // Second session continues from there.
    result = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      [wireEvent("textinput", "update", "q1", { text: "revised" })],
      loaded.lastEventId,
    );
    expect(result.conflict).toBe(false);

    const final = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    expect(rowsOf(final, "textinput")).toEqual([{ id: "q1", text: "revised" }]);
  });

  it("recovers from a conflict by re-sending against the fetched watermark", async () => {
    // Another device writes while this client is offline.
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("bookmarks", "create", "/other", { path: "/other" }),
    ]);

    const pending = [wireEvent("bookmarks", "create", "/mine", { path: "/mine" })];

    const stale = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      pending,
      0,
    );
    expect(stale.conflict).toBe(true);

    // This is what resolveConflict() does: re-fetch, then re-send the same
    // batch against the new watermark. Neither device's work is lost.
    const fetched = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    const retry = await db.appendEventsIfCurrent(
      USER_ID,
      HYPERBOOK_ID,
      pending,
      fetched.lastEventId,
    );
    expect(retry.conflict).toBe(false);

    const merged = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    expect(rowsOf(merged, "bookmarks")).toEqual([
      { path: "/other" },
      { path: "/mine" },
    ]);
  });

  it("flushes a chained offline queue without conflicting with itself", async () => {
    // Three batches queued while offline. Each must chain onto the watermark
    // the previous one produced, not the one recorded at enqueue time.
    const batches = [
      [wireEvent("bookmarks", "create", "/a", { path: "/a" })],
      [wireEvent("bookmarks", "create", "/b", { path: "/b" })],
      [wireEvent("bookmarks", "delete", "/a")],
    ];

    let watermark = 0;
    for (const batch of batches) {
      const result = await db.appendEventsIfCurrent(
        USER_ID,
        HYPERBOOK_ID,
        batch,
        watermark,
      );
      expect(result.conflict).toBe(false);
      watermark = result.lastEventId;
    }

    const state = await db.reconstructState(USER_ID, HYPERBOOK_ID);
    expect(rowsOf(state, "bookmarks")).toEqual([{ path: "/b" }]);
  });
});

// ===== Admin view helper =====

describe("getStoreUpdatedAt", () => {
  it("is null before anything is stored", async () => {
    expect(await db.getStoreUpdatedAt(USER_ID, HYPERBOOK_ID)).toBeNull();
  });

  it("reports a timestamp once events exist", async () => {
    await db.appendEvents(USER_ID, HYPERBOOK_ID, [
      wireEvent("consent", "create", 1, { id: 1 }),
    ]);

    expect(await db.getStoreUpdatedAt(USER_ID, HYPERBOOK_ID)).toBeTruthy();
  });

  it("falls back to the snapshot when the log is empty", async () => {
    await db.replaceWithSnapshot(USER_ID, HYPERBOOK_ID, snapshotBody([]));

    expect(await db.getStoreUpdatedAt(USER_ID, HYPERBOOK_ID)).toBeTruthy();
  });
});
