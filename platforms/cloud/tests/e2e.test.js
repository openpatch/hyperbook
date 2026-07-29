import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import db from "../lib/db.js";
import auth from "../lib/auth.js";
import storeRouter from "../routes/store.js";
import { createBrowser } from "./e2eBrowser.js";

// End-to-end: the shipped browser assets running on a real Dexie database,
// talking over real HTTP to the real router, backed by real sqlite.
//
// The other suites each stub one half — cloud.test.ts fakes the server,
// storeRoutes.test.js fakes the client. This one stubs neither, so it is the
// only place a client/server contract mismatch shows up.
//
// Vite loads lib/db.js twice (this file's ESM import and the router's
// require()), so a shared DATABASE_PATH is what gives both copies one database.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-e2e-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.sqlite");

let server;
let baseUrl;
let token;
const sessions = [];

beforeAll(async () => {
  await db.initializeDatabase();

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/store", storeRouter);
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  for (const table of [
    "events",
    "snapshots",
    "users",
    "groups",
    "hyperbooks",
  ]) {
    await db.runAsync("DELETE FROM " + table);
  }
  await db.runAsync("DELETE FROM sqlite_sequence");
  await db.runAsync(
    "INSERT INTO hyperbooks (slug, name) VALUES ('test', 'Test')",
  );
  await db.runAsync("INSERT INTO groups (hyperbook_id, name) VALUES (1, 'G')");
  await db.runAsync(
    "INSERT INTO users (username, password, role, group_id) VALUES ('student1', 'x', 'student', 1)",
  );

  token = auth.generateToken({ id: 1, username: "student1", role: "student" });
});

afterEach(async () => {
  while (sessions.length) await sessions.pop().close();
});

/** Open a browser session; closed automatically after the test. */
async function open(options = {}) {
  const session = await createBrowser({ baseUrl, token, ...options });
  sessions.push(session);
  return session;
}

/** What the server would hand a fresh client, reconstructed from scratch. */
async function serverState() {
  const state = await db.reconstructState(1, 1);
  const tables = {};
  const payload = state?.data?.data?.hyperbook?.data;
  for (const entry of payload?.data || []) {
    tables[entry.tableName] = entry.rows;
  }
  return { tables, lastEventId: state?.lastEventId ?? 0, raw: state };
}

/** Force compaction: fold every event into a fresh snapshot. */
async function compact() {
  const state = await db.reconstructState(1, 1);
  await db.createSnapshot(1, 1, state.data, state.lastEventId);
}

describe("e2e: a single session", () => {
  it("persists a Dexie write to the server", async () => {
    const a = await open();

    await a.db.bookmarks.put({ path: "/chapter-1", label: "Chapter 1" });
    await a.settle();

    const { tables } = await serverState();
    expect(tables.bookmarks).toEqual([
      { path: "/chapter-1", label: "Chapter 1" },
    ]);
  });

  it("keys rows by the table's own primary key, not by 'id'", async () => {
    // With no prior snapshot the server used to assume every table was keyed
    // by `id`, stamping a bogus `id` onto rows of tables that are not.
    const a = await open();

    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.db.onlineide.put({ scriptId: "s1", script: "print(1)" });
    await a.db.sqlideDatabases.put({ databaseId: "d1", database: "x" });
    await a.settle();

    const { tables } = await serverState();
    expect(tables.bookmarks).toEqual([{ path: "/a", label: "A" }]);
    expect(tables.onlineide).toEqual([{ scriptId: "s1", script: "print(1)" }]);
    expect(tables.sqlideDatabases).toEqual([
      { databaseId: "d1", database: "x" },
    ]);
  });

  it("replays updates and deletes onto the server state", async () => {
    const a = await open();

    await a.db.typst.put({ id: "doc", code: "one" });
    await a.db.bookmarks.put({ path: "/gone", label: "Gone" });
    await a.settle();

    await a.db.typst.update("doc", { code: "two" });
    await a.db.bookmarks.delete("/gone");
    await a.settle();

    const { tables } = await serverState();
    expect(tables.typst).toEqual([{ id: "doc", code: "two" }]);
    expect(tables.bookmarks).toEqual([]);
  });

  it("does not sync ephemeral currentState", async () => {
    // store.js writes cursor and scroll position into currentState constantly.
    const a = await open();

    await a.db.currentState.update(1, { mouseX: 42, scrollY: 900 });
    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.settle();

    const { tables } = await serverState();
    expect(tables.bookmarks).toHaveLength(1);
    expect(tables.currentState ?? []).toEqual([]);
  });

  it("restores state the server only has as events, never as a snapshot", async () => {
    // The reconstruction the server builds from events alone carries a
    // placeholder databaseVersion that cannot match the store's. The import
    // used to reject it outright, so until something posted a real snapshot
    // every load restored nothing at all — silently, inside a catch.
    const first = await open();
    await first.db.textinput.put({ id: "q1", text: "typed" });
    await first.settle();
    await first.close();

    // No snapshot rows: the server is reconstructing purely from the event log.
    const snapshots = await db.allAsync("SELECT id FROM snapshots");
    expect(snapshots).toHaveLength(0);

    const second = await open();
    expect(await second.db.textinput.toArray()).toEqual([
      { id: "q1", text: "typed" },
    ]);
    expect(second.errors).toEqual([]);
  });

  it("survives a reload, restoring state from the server", async () => {
    const first = await open({ dbSuffix: "reload" });
    await first.db.typst.put({ id: "doc", code: "kept" });
    await first.db.bookmarks.put({ path: "/a", label: "A" });
    await first.settle();
    await first.close();

    // A different IndexedDB, as if on another machine: everything must come
    // back over the wire.
    const second = await open({ dbSuffix: "fresh" });

    expect(await second.db.typst.toArray()).toEqual([
      { id: "doc", code: "kept" },
    ]);
    expect(await second.db.bookmarks.toArray()).toEqual([
      { path: "/a", label: "A" },
    ]);
    expect(second.sync.lastEventId).toBeGreaterThan(0);
  });
});

describe("e2e: two sessions", () => {
  it("carries one session's writes to the next session that loads", async () => {
    const a = await open();
    await a.db.textinput.put({ id: "q1", text: "answer" });
    await a.settle();

    const b = await open();
    expect(await b.db.textinput.toArray()).toEqual([
      { id: "q1", text: "answer" },
    ]);
  });

  it("merges a conflicting write instead of discarding it", async () => {
    // Both sessions start level, then each writes. The second to save is stale
    // and gets a 409; its work must survive the merge.
    const a = await open();
    const b = await open();

    await a.db.textinput.put({ id: "from-a", text: "A" });
    await a.settle();

    await b.db.textinput.put({ id: "from-b", text: "B" });
    await b.settle();
    await new Promise((r) => setTimeout(r, 50));

    const { tables } = await serverState();
    const ids = tables.textinput.map((r) => r.id).sort();
    expect(ids).toEqual(["from-a", "from-b"]);
  });

  it("explains the merge, then reloads so components see it", async () => {
    const a = await open();
    const b = await open();

    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.settle();

    await b.db.bookmarks.put({ path: "/b", label: "B" });
    await b.settle();
    await new Promise((r) => setTimeout(r, 50));

    // The reload is announced and deferred rather than sprung on the reader.
    expect(b.ui.notice).not.toBeNull();
    expect(b.ui.notice.textContent).toContain("another session");
    expect(b.reloads).toBe(0);

    const reloadNow = b.ui.notice.children.find((c) => c.tagName === "button");
    reloadNow.click();
    expect(b.reloads).toBe(1);

    // The merge pulled A down into B's local database.
    const paths = (await b.db.bookmarks.toArray()).map((r) => r.path).sort();
    expect(paths).toEqual(["/a", "/b"]);
  });

  it("namespaces the watermark it persists per hyperbook", async () => {
    const a = await open({ hyperbookId: "test" });
    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.settle();

    expect(a.localStorage.get("hyperbook_last_event_id:test")).toBe(
      String((await serverState()).lastEventId),
    );
    expect(a.localStorage.has("hyperbook_last_event_id")).toBe(false);
  });
});

describe("e2e: offline and reconnect", () => {
  it("queues writes made offline and flushes them in order on reconnect", async () => {
    const a = await open();

    a.setOnline(false);
    await a.db.bookmarks.put({ path: "/1", label: "One" });
    await a.settle();
    await a.db.bookmarks.put({ path: "/2", label: "Two" });
    await a.settle();
    await a.db.bookmarks.put({ path: "/3", label: "Three" });
    await a.settle();

    expect((await serverState()).lastEventId).toBe(0);
    expect(a.sync.offlineQueue.length).toBeGreaterThan(1);

    a.setOnline(true);
    await a.sync.processOfflineQueue();

    const { tables } = await serverState();
    expect(tables.bookmarks.map((r) => r.path).sort()).toEqual([
      "/1",
      "/2",
      "/3",
    ]);
    expect(a.sync.offlineQueue).toHaveLength(0);
  });

  it("recovers when the server moved on while a session was offline", async () => {
    const a = await open();
    const b = await open();

    a.setOnline(false);
    await a.db.textinput.put({ id: "offline", text: "written offline" });
    await a.settle();

    await b.db.textinput.put({ id: "online", text: "written online" });
    await b.settle();

    a.setOnline(true);
    await a.sync.processOfflineQueue();
    await new Promise((r) => setTimeout(r, 50));

    const { tables } = await serverState();
    expect(tables.textinput.map((r) => r.id).sort()).toEqual([
      "offline",
      "online",
    ]);
  });
});

describe("e2e: unload flush", () => {
  it("delivers changes still inside the debounce window", async () => {
    const a = await open();
    a.sync.debounceDelay = 60_000; // nothing will save on its own

    await a.db.bookmarks.put({ path: "/unsaved", label: "Unsaved" });
    await new Promise((r) => setTimeout(r, 10));
    expect((await serverState()).lastEventId).toBe(0);

    a.fire("pagehide");
    await new Promise((r) => setTimeout(r, 50));

    const { tables } = await serverState();
    expect(tables.bookmarks).toEqual([{ path: "/unsaved", label: "Unsaved" }]);
  });
});

describe("e2e: snapshots", () => {
  it("compacts to a snapshot and keeps serving the same state", async () => {
    const a = await open();
    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.db.typst.put({ id: "doc", code: "hello" });
    await a.settle();

    const before = await serverState();
    await compact();
    const after = await serverState();

    expect(after.tables.bookmarks).toEqual(before.tables.bookmarks);
    expect(after.tables.typst).toEqual(before.tables.typst);

    // A fresh session must still see it after compaction.
    const b = await open();
    expect(await b.db.typst.toArray()).toEqual([{ id: "doc", code: "hello" }]);
  });

  it("round-trips a full snapshot through export and import", async () => {
    const a = await open();
    await a.db.bookmarks.put({ path: "/a", label: "A" });
    await a.db.learningmap.put({
      id: "m1",
      nodes: [1, 2],
      x: 5,
      y: 6,
      zoom: 2,
    });
    await a.cloud.sendSnapshot();

    const b = await open();
    expect(await b.db.learningmap.toArray()).toEqual([
      { id: "m1", nodes: [1, 2], x: 5, y: 6, zoom: 2 },
    ]);
    expect(await b.db.bookmarks.toArray()).toEqual([
      { path: "/a", label: "A" },
    ]);
  });
});
