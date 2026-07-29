import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import db from "../lib/db.js";
import auth from "../lib/auth.js";
import storeRouter from "../routes/store.js";

// Drives the real router over a real HTTP server, so the status codes the
// client branches on (400 vs 409 vs 5xx) are covered end to end.
//
// Vite loads lib/db.js twice here — once for this file's ESM import and once
// for the router's require() — so injecting a handle would only reach one of
// them. Pointing both at the same temporary file via DATABASE_PATH (read
// lazily, on first connection) gives them a shared database instead.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-cloud-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.sqlite");

let server;
let baseUrl;
let token;
let readonlyToken;

beforeAll(async () => {
  await db.initializeDatabase();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  for (const table of ["events", "snapshots", "users", "groups", "hyperbooks"]) {
    await db.runAsync("DELETE FROM " + table);
  }
  await db.runAsync("DELETE FROM sqlite_sequence");

  await db.runAsync("INSERT INTO hyperbooks (slug, name) VALUES ('test', 'Test')");
  await db.runAsync("INSERT INTO groups (hyperbook_id, name) VALUES (1, 'Group')");
  await db.runAsync(
    "INSERT INTO users (username, password, role, group_id) VALUES ('student1', 'x', 'student', 1)",
  );

  token = auth.generateToken({ id: 1, username: "student1", role: "student" });
  readonlyToken = auth.generateToken({
    id: 1,
    username: "student1",
    role: "student",
    readonly: true,
  });

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/store", storeRouter);

  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ===== Helpers =====

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token ?? token}`,
      ...options.headers,
    },
  });
}

function postEvents(events, afterEventId, options = {}) {
  return request("/api/store/test/events", {
    method: "POST",
    body: JSON.stringify({ events, afterEventId }),
    ...options,
  });
}

function wireEvent(table, op, primKey, data = null, schema = "id") {
  return { table, schema, op, primKey, data };
}

const emptySnapshot = {
  version: 1,
  origin: "https://example.org",
  data: {
    hyperbook: {
      formatName: "dexie",
      formatVersion: 1,
      data: {
        databaseName: "Hyperbook",
        databaseVersion: 5,
        tables: [],
        data: [],
      },
    },
  },
};

// ===== Auth =====

describe("auth", () => {
  it("rejects a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/store/test`);
    expect(res.status).toBe(401);
  });

  it("rejects a request with a bad token", async () => {
    const res = await request("/api/store/test", { token: "not-a-token" });
    expect(res.status).toBe(403);
  });

  it("refuses writes from a read-only (impersonation) session", async () => {
    const events = await postEvents([wireEvent("consent", "create", 1, { id: 1 })], 0, {
      token: readonlyToken,
    });
    expect(events.status).toBe(403);

    const snapshot = await request("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({ data: emptySnapshot }),
      token: readonlyToken,
    });
    expect(snapshot.status).toBe(403);
  });

  it("still allows a read-only session to read", async () => {
    await postEvents([wireEvent("consent", "create", 1, { id: 1 })], 0);

    const res = await request("/api/store/test", { token: readonlyToken });
    expect(res.status).toBe(200);
  });
});

// ===== GET =====

describe("GET /api/store/:hyperbookId", () => {
  it("404s for an unknown hyperbook", async () => {
    const res = await request("/api/store/nope");
    expect(res.status).toBe(404);
  });

  it("404s when the user has nothing stored yet", async () => {
    const res = await request("/api/store/test");
    expect(res.status).toBe(404);
  });

  it("returns the snapshot and the watermark", async () => {
    await postEvents(
      [wireEvent("bookmarks", "create", "/a", { path: "/a" }, "path")],
      0,
    );

    const res = await request("/api/store/test");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastEventId).toBe(1);
    const rows = body.snapshot.data.hyperbook.data.data.find(
      (d) => d.tableName === "bookmarks",
    ).rows;
    expect(rows).toEqual([{ path: "/a" }]);
  });
});

// ===== POST events =====

describe("POST /api/store/:hyperbookId/events", () => {
  it("accepts a batch and reports the new watermark", async () => {
    const res = await postEvents(
      [wireEvent("consent", "create", 1, { id: 1, accepted: true })],
      0,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastEventId).toBe(1);
  });

  it("409s a stale client and reports the server watermark", async () => {
    await postEvents([wireEvent("consent", "create", 1, { id: 1 })], 0);

    const res = await postEvents(
      [wireEvent("consent", "update", 1, { accepted: true })],
      0,
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.serverLastEventId).toBe(1);
  });

  it("lets the client recover from a 409 by re-sending at the new watermark", async () => {
    await postEvents([wireEvent("consent", "create", 1, { id: 1 })], 0);

    const conflict = await postEvents(
      [wireEvent("consent", "update", 1, { accepted: true })],
      0,
    );
    const { serverLastEventId } = await conflict.json();

    const retry = await postEvents(
      [wireEvent("consent", "update", 1, { accepted: true })],
      serverLastEventId,
    );
    expect(retry.status).toBe(200);
  });

  it("400s an empty batch", async () => {
    const res = await postEvents([], 0);
    expect(res.status).toBe(400);
  });

  it("400s a missing events array", async () => {
    const res = await request("/api/store/test/events", {
      method: "POST",
      body: JSON.stringify({ afterEventId: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("400s an unknown operation instead of 500ing on the CHECK constraint", async () => {
    // The client retries 5xx forever but treats 4xx as terminal, so a
    // malformed batch must not come back as a server error.
    const res = await postEvents(
      [{ table: "consent", op: "truncate", primKey: 1, data: {} }],
      0,
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid operation/);
  });

  it("400s an event with no table name", async () => {
    const res = await postEvents([{ op: "create", primKey: 1, data: {} }], 0);
    expect(res.status).toBe(400);
  });

  it("appends nothing when any event in the batch is invalid", async () => {
    await postEvents(
      [
        wireEvent("consent", "create", 1, { id: 1 }),
        { table: "consent", op: "nope", primKey: 2, data: {} },
      ],
      0,
    );

    const { c } = await db.getAsync("SELECT COUNT(*) c FROM events");
    expect(c).toBe(0);
  });

  it("404s for an unknown hyperbook", async () => {
    const res = await request("/api/store/nope/events", {
      method: "POST",
      body: JSON.stringify({
        events: [wireEvent("consent", "create", 1, { id: 1 })],
        afterEventId: 0,
      }),
    });
    expect(res.status).toBe(404);
  });
});

// ===== POST snapshot =====

describe("POST /api/store/:hyperbookId/snapshot", () => {
  it("accepts a snapshot and resets the watermark", async () => {
    await postEvents([wireEvent("consent", "create", 1, { id: 1 })], 0);

    const res = await request("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({ data: emptySnapshot }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastEventId).toBe(0);

    // The watermark it reported must be the one the next append accepts.
    const next = await postEvents(
      [wireEvent("consent", "create", 1, { id: 1 })],
      body.lastEventId,
    );
    expect(next.status).toBe(200);
  });

  it("400s a missing body", async () => {
    const res = await request("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("404s for an unknown hyperbook", async () => {
    const res = await request("/api/store/nope/snapshot", {
      method: "POST",
      body: JSON.stringify({ data: emptySnapshot }),
    });
    expect(res.status).toBe(404);
  });
});

// ===== Round trip =====

describe("round trip", () => {
  it("serves back exactly what a sequence of batches produced", async () => {
    let watermark = 0;

    for (const batch of [
      [wireEvent("bookmarks", "create", "/a", { path: "/a", label: "A" }, "path")],
      [wireEvent("bookmarks", "create", "/b", { path: "/b", label: "B" }, "path")],
      [wireEvent("bookmarks", "delete", "/a", null, "path")],
    ]) {
      const res = await postEvents(batch, watermark);
      expect(res.status).toBe(200);
      watermark = (await res.json()).lastEventId;
    }

    const res = await request("/api/store/test");
    const body = await res.json();
    const rows = body.snapshot.data.hyperbook.data.data.find(
      (d) => d.tableName === "bookmarks",
    ).rows;

    expect(rows).toEqual([{ path: "/b", label: "B" }]);
    expect(body.lastEventId).toBe(watermark);
  });

  it("keeps a table keyed by something other than id clean", async () => {
    // Regression: with no prior snapshot the server used to assume the key
    // field was "id" and stamp a bogus id onto every row.
    await postEvents(
      [
        wireEvent("onlineide", "create", "s1", { scriptId: "s1", script: "a" }, "scriptId"),
        wireEvent("onlineide", "update", "s1", { script: "b" }, "scriptId"),
      ],
      0,
    );

    const body = await (await request("/api/store/test")).json();
    const dexie = body.snapshot.data.hyperbook.data;
    const rows = dexie.data.find((d) => d.tableName === "onlineide").rows;

    expect(rows).toEqual([{ scriptId: "s1", script: "b" }]);
    expect(dexie.tables.find((t) => t.name === "onlineide").schema).toBe(
      "scriptId",
    );
  });
});
