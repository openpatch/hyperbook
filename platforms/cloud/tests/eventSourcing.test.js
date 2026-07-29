import { describe, it, expect } from "vitest";
import {
  applyEventsToSnapshot,
  createEmptySnapshot,
  parsePrimaryKey,
  readEventPrimKey,
  validateEvents,
} from "../lib/eventSourcing.js";

// ===== Helpers =====

let nextEventId = 1;

/** Build an event row the way the `events` table hands it to the replayer. */
function event(tableName, operation, primKey, data) {
  return {
    id: nextEventId++,
    table_name: tableName,
    operation,
    prim_key: String(primKey),
    prim_key_json: JSON.stringify(primKey),
    data: data === undefined || data === null ? null : JSON.stringify(data),
    created_at: "2026-01-01 00:00:00",
  };
}

/** Event row carrying the client-reported Dexie primary-key source string. */
function schemaEvent(tableName, schema, operation, primKey, data) {
  return { ...event(tableName, operation, primKey, data), table_schema: schema };
}

/** Legacy event row, written before the prim_key_json migration. */
function legacyEvent(tableName, operation, primKey, data) {
  const evt = event(tableName, operation, primKey, data);
  delete evt.prim_key_json;
  return evt;
}

/** Snapshot in the real Dexie shape: tables[] describing, data[] holding rows. */
function dexieSnapshot(tables) {
  return {
    version: 1,
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

/** Snapshot in the simplified shape: rows live on the table entries. */
function simpleSnapshot(tables) {
  return {
    version: 1,
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
            rows: t.rows || [],
          })),
        },
      },
    },
  };
}

/** Read the reconstructed rows for a table out of either snapshot shape. */
function rowsOf(snapshot, tableName) {
  const dexie = snapshot.data.hyperbook.data;
  if (Array.isArray(dexie.data)) {
    const entry = dexie.data.find((d) => d.tableName === tableName);
    return entry ? entry.rows : undefined;
  }
  const table = dexie.tables.find((t) => t.name === tableName);
  return table ? table.rows : undefined;
}

function tableOf(snapshot, tableName) {
  return snapshot.data.hyperbook.data.tables.find((t) => t.name === tableName);
}

// ===== parsePrimaryKey =====

describe("parsePrimaryKey", () => {
  it("reads a plain primary key", () => {
    expect(parsePrimaryKey("id")).toEqual({
      fields: ["id"],
      compound: false,
      outbound: false,
    });
  });

  it("ignores the index fields after the primary key", () => {
    expect(parsePrimaryKey("id,path,label").fields).toEqual(["id"]);
  });

  it("strips the auto-increment marker", () => {
    // "++id" as a literal property name matches nothing on a real row.
    expect(parsePrimaryKey("++id,name").fields).toEqual(["id"]);
  });

  it("strips the unique marker", () => {
    expect(parsePrimaryKey("&email").fields).toEqual(["email"]);
  });

  it("strips the multi-entry marker", () => {
    expect(parsePrimaryKey("*tags").fields).toEqual(["tags"]);
  });

  it("parses a compound primary key", () => {
    expect(parsePrimaryKey("[postId+userId],date")).toEqual({
      fields: ["postId", "userId"],
      compound: true,
      outbound: false,
    });
  });

  it("flags an outbound (empty) primary key", () => {
    expect(parsePrimaryKey("").outbound).toBe(true);
    expect(parsePrimaryKey(undefined).outbound).toBe(true);
  });

  it("handles the real hyperbook schemas", () => {
    expect(parsePrimaryKey("id,tune").fields).toEqual(["id"]);
    expect(parsePrimaryKey("path,label").fields).toEqual(["path"]);
    expect(parsePrimaryKey("scriptId,script").fields).toEqual(["scriptId"]);
    expect(parsePrimaryKey("databaseId,database").fields).toEqual([
      "databaseId",
    ]);
  });
});

// ===== readEventPrimKey =====

describe("readEventPrimKey", () => {
  it("restores a numeric key from the json column", () => {
    expect(readEventPrimKey(event("consent", "delete", 42))).toBe(42);
  });

  it("restores a compound key from the json column", () => {
    expect(readEventPrimKey(event("t", "delete", [1, "a"]))).toEqual([1, "a"]);
  });

  it("falls back to the text column for legacy rows", () => {
    expect(readEventPrimKey(legacyEvent("consent", "delete", 42))).toBe("42");
  });
});

// ===== validateEvents =====

describe("validateEvents", () => {
  it("accepts a well-formed batch", () => {
    expect(
      validateEvents([
        { table: "bookmarks", op: "create", primKey: "/a", data: { path: "/a" } },
        { table: "bookmarks", op: "delete", primKey: "/a", data: null },
      ]),
    ).toBeNull();
  });

  it("rejects a non-array", () => {
    expect(validateEvents(null)).toMatch(/required/);
    expect(validateEvents("nope")).toMatch(/required/);
  });

  it("rejects an empty batch", () => {
    expect(validateEvents([])).toMatch(/required/);
  });

  it("rejects an unknown operation before it reaches the CHECK constraint", () => {
    const error = validateEvents([
      { table: "t", op: "drop", primKey: 1, data: {} },
    ]);
    expect(error).toMatch(/invalid operation/);
  });

  it("rejects a missing table name", () => {
    expect(validateEvents([{ op: "create", primKey: 1, data: {} }])).toMatch(
      /table name/,
    );
  });

  it("rejects a missing primKey", () => {
    expect(validateEvents([{ table: "t", op: "create", data: {} }])).toMatch(
      /primKey/,
    );
  });

  it("rejects create/update without data but allows delete without data", () => {
    expect(validateEvents([{ table: "t", op: "create", primKey: 1 }])).toMatch(
      /missing data/,
    );
    expect(
      validateEvents([{ table: "t", op: "delete", primKey: 1 }]),
    ).toBeNull();
  });

  it("reports the index of the offending event", () => {
    const error = validateEvents([
      { table: "t", op: "create", primKey: 1, data: {} },
      { table: "t", op: "explode", primKey: 2, data: {} },
    ]);
    expect(error).toMatch(/Event 1/);
  });
});

// ===== applyEventsToSnapshot =====

describe("applyEventsToSnapshot", () => {
  describe("basics", () => {
    it("returns the snapshot untouched for an empty or missing event list", () => {
      const snapshot = dexieSnapshot([{ name: "consent", schema: "id" }]);
      expect(applyEventsToSnapshot(snapshot, [])).toBe(snapshot);
      expect(applyEventsToSnapshot(snapshot, null)).toBe(snapshot);
    });

    it("applies a create to an empty snapshot", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        event("consent", "create", 1, { id: 1, accepted: true }),
      ]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1, accepted: true }]);
      expect(tableOf(snapshot, "consent").rowCount).toBe(1);
    });

    it("applies an update to an existing row", () => {
      const snapshot = dexieSnapshot([
        { name: "textinput", schema: "id,text", rows: [{ id: "q1", text: "a" }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("textinput", "update", "q1", { text: "b" }),
      ]);

      expect(rowsOf(snapshot, "textinput")).toEqual([{ id: "q1", text: "b" }]);
    });

    it("applies a delete", () => {
      const snapshot = dexieSnapshot([
        {
          name: "bookmarks",
          schema: "path,label",
          rows: [{ path: "/a" }, { path: "/b" }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [event("bookmarks", "delete", "/a")]);

      expect(rowsOf(snapshot, "bookmarks")).toEqual([{ path: "/b" }]);
      expect(tableOf(snapshot, "bookmarks").rowCount).toBe(1);
    });

    it("ignores a delete for a row that is not there", () => {
      const snapshot = dexieSnapshot([
        { name: "bookmarks", schema: "path,label", rows: [{ path: "/b" }] },
      ]);
      applyEventsToSnapshot(snapshot, [event("bookmarks", "delete", "/gone")]);

      expect(rowsOf(snapshot, "bookmarks")).toEqual([{ path: "/b" }]);
    });

    it("replays create, update and delete in order", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        event("pyide", "create", "s1", { id: "s1", script: "print(1)" }),
        event("pyide", "update", "s1", { script: "print(2)" }),
        event("pyide", "create", "s2", { id: "s2", script: "x=1" }),
        event("pyide", "delete", "s1"),
      ]);

      expect(rowsOf(snapshot, "pyide")).toEqual([{ id: "s2", script: "x=1" }]);
    });

    it("creates a table entry for an unknown table", () => {
      const snapshot = dexieSnapshot([{ name: "consent", schema: "id" }]);
      applyEventsToSnapshot(snapshot, [
        event("typst", "create", "t1", { id: "t1", code: "#set page()" }),
      ]);

      expect(tableOf(snapshot, "consent")).toBeDefined();
      expect(tableOf(snapshot, "typst")).toBeDefined();
      expect(rowsOf(snapshot, "typst")).toEqual([
        { id: "t1", code: "#set page()" },
      ]);
    });

    it("preserves the wrapper structure", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        event("consent", "create", 1, { id: 1 }),
      ]);

      expect(snapshot.version).toBe(1);
      expect(snapshot.data.hyperbook.formatName).toBe("dexie");
      expect(snapshot.data.hyperbook.data.databaseName).toBe("Hyperbook");
    });
  });

  describe("primary key handling", () => {
    it("matches rows on an auto-increment schema", () => {
      // Regression: the primary key was read as the literal token "++id",
      // so every update and delete missed and silently duplicated rows.
      const snapshot = dexieSnapshot([
        { name: "notes", schema: "++id,body", rows: [{ id: 1, body: "old" }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("notes", "update", 1, { body: "new" }),
      ]);

      expect(rowsOf(snapshot, "notes")).toEqual([{ id: 1, body: "new" }]);
    });

    it("deletes rows on an auto-increment schema", () => {
      const snapshot = dexieSnapshot([
        { name: "notes", schema: "++id", rows: [{ id: 1 }, { id: 2 }] },
      ]);
      applyEventsToSnapshot(snapshot, [event("notes", "delete", 1)]);

      expect(rowsOf(snapshot, "notes")).toEqual([{ id: 2 }]);
    });

    it("gives a created row its key when the client omitted it", () => {
      // Dexie's creating hook does not include an auto-incremented key in the
      // object it emits; without this the row is unreachable by later events.
      const snapshot = dexieSnapshot([{ name: "notes", schema: "++id,body" }]);
      applyEventsToSnapshot(snapshot, [
        event("notes", "create", 7, { body: "hello" }),
        event("notes", "update", 7, { body: "world" }),
      ]);

      expect(rowsOf(snapshot, "notes")).toEqual([{ id: 7, body: "world" }]);
    });

    it("does not overwrite a key the client did send", () => {
      const snapshot = dexieSnapshot([{ name: "consent", schema: "id" }]);
      applyEventsToSnapshot(snapshot, [
        event("consent", "create", 1, { id: 1, accepted: true }),
      ]);

      expect(rowsOf(snapshot, "consent")[0].id).toBe(1);
    });

    it("matches a numeric row key against a legacy stringified event key", () => {
      const snapshot = dexieSnapshot([
        { name: "consent", schema: "id", rows: [{ id: 1, accepted: false }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        legacyEvent("consent", "update", 1, { accepted: true }),
      ]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1, accepted: true }]);
    });

    it("handles compound primary keys", () => {
      const snapshot = dexieSnapshot([
        {
          name: "answers",
          schema: "[quizId+questionId],value",
          rows: [{ quizId: "q", questionId: 1, value: "a" }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("answers", "update", ["q", 1], { value: "b" }),
        event("answers", "create", ["q", 2], {
          quizId: "q",
          questionId: 2,
          value: "c",
        }),
      ]);

      expect(rowsOf(snapshot, "answers")).toEqual([
        { quizId: "q", questionId: 1, value: "b" },
        { quizId: "q", questionId: 2, value: "c" },
      ]);
    });

    it("deletes by compound primary key", () => {
      const snapshot = dexieSnapshot([
        {
          name: "answers",
          schema: "[quizId+questionId]",
          rows: [
            { quizId: "q", questionId: 1 },
            { quizId: "q", questionId: 2 },
          ],
        },
      ]);
      applyEventsToSnapshot(snapshot, [event("answers", "delete", ["q", 1])]);

      expect(rowsOf(snapshot, "answers")).toEqual([
        { quizId: "q", questionId: 2 },
      ]);
    });

    it("uses the non-default key field of a hyperbook table", () => {
      const snapshot = dexieSnapshot([
        {
          name: "onlineide",
          schema: "scriptId,script",
          rows: [{ scriptId: "a", script: "one" }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("onlineide", "update", "a", { script: "two" }),
      ]);

      expect(rowsOf(snapshot, "onlineide")).toEqual([
        { scriptId: "a", script: "two" },
      ]);
    });
  });

  describe("client-reported schema", () => {
    it("uses the reported key field for a table it has never seen", () => {
      // Without the reported schema the server assumes "id" and stamps a bogus
      // id onto every row of a table keyed by something else.
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        schemaEvent("bookmarks", "path", "create", "/a", {
          path: "/a",
          label: "A",
        }),
      ]);

      expect(rowsOf(snapshot, "bookmarks")).toEqual([
        { path: "/a", label: "A" },
      ]);
      expect(tableOf(snapshot, "bookmarks").schema).toBe("path");
    });

    it("matches later events against the reported key field", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        schemaEvent("onlineide", "scriptId", "create", "s1", {
          scriptId: "s1",
          script: "a",
        }),
        schemaEvent("onlineide", "scriptId", "update", "s1", { script: "b" }),
      ]);

      expect(rowsOf(snapshot, "onlineide")).toEqual([
        { scriptId: "s1", script: "b" },
      ]);
    });

    it("prefers the schema already recorded in the snapshot", () => {
      const snapshot = dexieSnapshot([
        { name: "bookmarks", schema: "path,label", rows: [{ path: "/a" }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        schemaEvent("bookmarks", "path", "delete", "/a"),
      ]);

      expect(tableOf(snapshot, "bookmarks").schema).toBe("path,label");
      expect(rowsOf(snapshot, "bookmarks")).toEqual([]);
    });

    it("still falls back to id when a legacy event reports no schema", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        event("consent", "create", 1, { id: 1, accepted: true }),
      ]);

      expect(tableOf(snapshot, "consent").schema).toBe("id");
      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1, accepted: true }]);
    });

    it("handles a reported compound key on an unseen table", () => {
      const snapshot = createEmptySnapshot();
      applyEventsToSnapshot(snapshot, [
        schemaEvent("answers", "[quizId+questionId]", "create", ["q", 1], {
          quizId: "q",
          questionId: 1,
          value: "a",
        }),
        schemaEvent("answers", "[quizId+questionId]", "update", ["q", 1], {
          value: "b",
        }),
      ]);

      expect(rowsOf(snapshot, "answers")).toEqual([
        { quizId: "q", questionId: 1, value: "b" },
      ]);
    });
  });

  describe("idempotent replay", () => {
    it("does not duplicate a row when the same create is replayed", () => {
      // Batches are re-sent after a network failure and replayed out of the
      // offline queue, so the same create can legitimately arrive twice.
      const snapshot = createEmptySnapshot();
      const create = event("consent", "create", 1, { id: 1, accepted: true });

      applyEventsToSnapshot(snapshot, [create, { ...create, id: 99 }]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1, accepted: true }]);
      expect(tableOf(snapshot, "consent").rowCount).toBe(1);
    });

    it("lets a later create overwrite the row it duplicates", () => {
      const snapshot = dexieSnapshot([
        { name: "typst", schema: "id,code", rows: [{ id: "t", code: "old" }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("typst", "create", "t", { id: "t", code: "new" }),
      ]);

      expect(rowsOf(snapshot, "typst")).toEqual([{ id: "t", code: "new" }]);
    });

    it("is stable when a whole batch is replayed twice", () => {
      const batch = () => [
        event("bookmarks", "create", "/a", { path: "/a", label: "A" }),
        event("bookmarks", "create", "/b", { path: "/b", label: "B" }),
        event("bookmarks", "delete", "/a"),
      ];

      const once = applyEventsToSnapshot(createEmptySnapshot(), batch());
      const twice = applyEventsToSnapshot(
        createEmptySnapshot(),
        batch().concat(batch()),
      );

      expect(rowsOf(twice, "bookmarks")).toEqual(rowsOf(once, "bookmarks"));
    });

    it("removes every duplicate of a key on delete", () => {
      // Rows duplicated by an older buggy replay must not survive a delete.
      const snapshot = dexieSnapshot([
        {
          name: "consent",
          schema: "id",
          rows: [{ id: 1 }, { id: 1 }, { id: 2 }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [event("consent", "delete", 1)]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 2 }]);
      expect(tableOf(snapshot, "consent").rowCount).toBe(1);
    });
  });

  describe("updates", () => {
    it("treats an update on a missing row as an insert carrying the key", () => {
      const snapshot = dexieSnapshot([{ name: "audio", schema: "id,time" }]);
      applyEventsToSnapshot(snapshot, [
        event("audio", "update", "clip", { time: 12 }),
      ]);

      expect(rowsOf(snapshot, "audio")).toEqual([{ time: 12, id: "clip" }]);
    });

    it("merges rather than replaces the row", () => {
      const snapshot = dexieSnapshot([
        {
          name: "webide",
          schema: "id,html,css,js",
          rows: [{ id: "w", html: "<p>", css: "p{}", js: "1" }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("webide", "update", "w", { js: "2" }),
      ]);

      expect(rowsOf(snapshot, "webide")).toEqual([
        { id: "w", html: "<p>", css: "p{}", js: "2" },
      ]);
    });

    it("resolves Dexie dotted key paths into nested properties", () => {
      // table.update(id, { "state.zoom": 2 }) addresses a nested property;
      // assigning the literal key "state.zoom" would lose the update.
      const snapshot = dexieSnapshot([
        {
          name: "learningmap",
          schema: "id,nodes,x,y,zoom",
          rows: [{ id: "m", state: { zoom: 1, pan: 0 } }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("learningmap", "update", "m", { "state.zoom": 2 }),
      ]);

      expect(rowsOf(snapshot, "learningmap")).toEqual([
        { id: "m", state: { zoom: 2, pan: 0 } },
      ]);
    });

    it("creates intermediate objects for a dotted path", () => {
      const snapshot = dexieSnapshot([
        { name: "custom", schema: "id,payload", rows: [{ id: "c" }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("custom", "update", "c", { "payload.a.b": 1 }),
      ]);

      expect(rowsOf(snapshot, "custom")).toEqual([
        { id: "c", payload: { a: { b: 1 } } },
      ]);
    });

    it("only touches the addressed row", () => {
      const snapshot = dexieSnapshot([
        {
          name: "tabs",
          schema: "id,active",
          rows: [
            { id: "t1", active: 0 },
            { id: "t2", active: 0 },
          ],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("tabs", "update", "t2", { active: 1 }),
      ]);

      expect(rowsOf(snapshot, "tabs")).toEqual([
        { id: "t1", active: 0 },
        { id: "t2", active: 1 },
      ]);
    });
  });

  describe("snapshot shapes", () => {
    it("works with the simplified shape (rows on the table entries)", () => {
      const snapshot = simpleSnapshot([
        { name: "consent", schema: "id", rows: [{ id: 1, accepted: false }] },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("consent", "update", 1, { accepted: true }),
        event("slideshow", "create", "s", { id: "s", active: 2 }),
      ]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1, accepted: true }]);
      expect(rowsOf(snapshot, "slideshow")).toEqual([{ id: "s", active: 2 }]);
    });

    it("handles a table entry with no rows array", () => {
      const snapshot = simpleSnapshot([{ name: "consent", schema: "id" }]);
      delete snapshot.data.hyperbook.data.tables[0].rows;

      applyEventsToSnapshot(snapshot, [
        event("consent", "create", 1, { id: 1 }),
      ]);

      expect(rowsOf(snapshot, "consent")).toEqual([{ id: 1 }]);
    });

    it("keeps the empty tables a real export carries", () => {
      const snapshot = dexieSnapshot([
        { name: "consent", schema: "id" },
        { name: "abcMusic", schema: "id,tune" },
        { name: "typst", schema: "id,code" },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("typst", "create", "t", { id: "t", code: "x" }),
      ]);

      const tables = snapshot.data.hyperbook.data.tables.map((t) => t.name);
      expect(tables).toEqual(["consent", "abcMusic", "typst"]);
      expect(rowsOf(snapshot, "consent")).toEqual([]);
      expect(rowsOf(snapshot, "typst")).toHaveLength(1);
    });

    it("throws a clear error when the snapshot has no Dexie payload", () => {
      expect(() =>
        applyEventsToSnapshot({ version: 1 }, [
          event("consent", "create", 1, { id: 1 }),
        ]),
      ).toThrow(/no Dexie payload/i);
    });
  });

  describe("payloads", () => {
    it("survives a large blob-ish value", () => {
      const elements = Array.from({ length: 500 }, (_, i) => ({
        id: `el-${i}`,
        type: "rectangle",
        x: i,
      }));
      const snapshot = createEmptySnapshot();

      applyEventsToSnapshot(snapshot, [
        event("excalidraw", "create", "d1", {
          id: "d1",
          excalidrawElements: elements,
        }),
      ]);

      expect(rowsOf(snapshot, "excalidraw")[0].excalidrawElements).toHaveLength(
        500,
      );
    });

    it("keeps null and false values instead of dropping them", () => {
      const snapshot = dexieSnapshot([
        {
          name: "protect",
          schema: "id,passwordHash",
          rows: [{ id: "p", passwordHash: "abc", unlocked: true }],
        },
      ]);
      applyEventsToSnapshot(snapshot, [
        event("protect", "update", "p", { passwordHash: null, unlocked: false }),
      ]);

      expect(rowsOf(snapshot, "protect")).toEqual([
        { id: "p", passwordHash: null, unlocked: false },
      ]);
    });
  });
});

// ===== createEmptySnapshot =====

describe("createEmptySnapshot", () => {
  it("has the shape the client feeds back into Dexie import", () => {
    const snapshot = createEmptySnapshot();

    expect(snapshot.data.hyperbook.formatName).toBe("dexie");
    expect(snapshot.data.hyperbook.data.tables).toEqual([]);
    expect(snapshot.data.hyperbook.data.data).toEqual([]);
  });

  it("returns a fresh object each call", () => {
    const a = createEmptySnapshot();
    applyEventsToSnapshot(a, [event("consent", "create", 1, { id: 1 })]);

    expect(createEmptySnapshot().data.hyperbook.data.tables).toEqual([]);
  });
});
