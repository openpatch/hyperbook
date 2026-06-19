import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function resetCloudModules() {
  ["../app", "../lib/db", "../lib/auth", "../middleware/auth", "../routes/store"].forEach(
    (mod) => {
      try {
        delete require.cache[require.resolve(mod)];
      } catch (_e) {
        // ignore
      }
    },
  );
}

describe("store API optimistic concurrency", () => {
  let dbFile;
  let db;
  let auth;
  let app;
  let server;
  let baseUrl;
  let token;

  async function api(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const body = await response.json();
    return { status: response.status, body };
  }

  beforeEach(async () => {
    dbFile = path.join(
      os.tmpdir(),
      `hyperbook-cloud-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
    );

    process.env.DATABASE_PATH = dbFile;
    process.env.JWT_SECRET = "test-secret";
    process.env.BASE_URL = "http://localhost:3000";

    resetCloudModules();

    db = require("../lib/db");
    await db.initializeDatabase();

    await db.runAsync("INSERT INTO hyperbooks (slug, name) VALUES (?, ?)", [
      "test",
      "Test Hyperbook",
    ]);
    await db.runAsync(
      "INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
      [1, "student1", "pass", "student"],
    );

    auth = require("../lib/auth");
    token = auth.generateToken({ id: 1, username: "student1", role: "student" });

    app = require("../app");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    resetCloudModules();

    try {
      fs.unlinkSync(dbFile);
    } catch (_e) {
      // ignore cleanup errors
    }
  });

  it("returns checksum on GET and snapshot responses", async () => {
    const snapshot = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        data: {
          version: 1,
          data: { hyperbook: { formatName: "dexie", formatVersion: 1, data: { tables: [] } } },
        },
      }),
    });

    expect(snapshot.status).toBe(200);
    expect(snapshot.body.stateChecksum).toBeTruthy();

    const loaded = await api("/api/store/test");
    expect(loaded.status).toBe(200);
    expect(loaded.body.stateChecksum).toBe(snapshot.body.stateChecksum);
  });

  it("rejects stale snapshot if ifMatchLastEventId mismatches", async () => {
    const initialSnapshot = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        data: {
          version: 1,
          data: { hyperbook: { formatName: "dexie", formatVersion: 1, data: { tables: [] } } },
        },
      }),
    });
    expect(initialSnapshot.status).toBe(200);

    const events = await api("/api/store/test/events", {
      method: "POST",
      body: JSON.stringify({
        afterEventId: 0,
        events: [
          {
            table: "collapsibles",
            op: "create",
            primKey: "s1",
            data: { id: "s1", collapsed: false },
          },
        ],
      }),
    });
    expect(events.status).toBe(200);

    const staleSnapshot = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        ifMatchLastEventId: 0,
        data: {
          version: 1,
          data: { hyperbook: { formatName: "dexie", formatVersion: 1, data: { tables: [] } } },
        },
      }),
    });

    expect(staleSnapshot.status).toBe(409);
    expect(staleSnapshot.body.serverLastEventId).toBe(events.body.lastEventId);
  });

  it("rejects stale snapshot if checksum mismatches unless forceOverwrite=true", async () => {
    const initialSnapshot = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        data: {
          version: 1,
          data: {
            hyperbook: {
              formatName: "dexie",
              formatVersion: 1,
              data: {
                tables: [
                  {
                    name: "tabs",
                    schema: "id",
                    rowCount: 1,
                    rows: [{ id: "t1", active: "a" }],
                  },
                ],
              },
            },
          },
        },
      }),
    });
    expect(initialSnapshot.status).toBe(200);

    const stale = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        ifMatchLastEventId: 0,
        ifMatchChecksum: "deadbeef",
        data: {
          version: 1,
          data: {
            hyperbook: {
              formatName: "dexie",
              formatVersion: 1,
              data: { tables: [] },
            },
          },
        },
      }),
    });

    expect(stale.status).toBe(409);
    expect(stale.body.serverChecksum).toBeTruthy();

    const forced = await api("/api/store/test/snapshot", {
      method: "POST",
      body: JSON.stringify({
        ifMatchLastEventId: 999,
        ifMatchChecksum: "deadbeef",
        forceOverwrite: true,
        data: {
          version: 1,
          data: {
            hyperbook: {
              formatName: "dexie",
              formatVersion: 1,
              data: { tables: [] },
            },
          },
        },
      }),
    });

    expect(forced.status).toBe(200);
    expect(forced.body.stateChecksum).toBeTruthy();
  });
});
