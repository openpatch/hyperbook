import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

const CLOUD_JS_PATH = "/home/runner/work/hyperbook/hyperbook/packages/markdown/assets/cloud.js";
const AUTH_TOKEN_KEY = "hyperbook_auth_token";
const OFFLINE_QUEUE_KEY = "hyperbook_offline_queue";

function createStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    _dump() {
      return { ...data };
    },
  };
}

function createToken(payload) {
  const base64Payload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `header.${base64Payload}.sig`;
}

function createSandbox({ online, storageSeed, fetchImpl }) {
  const localStorage = createStorage(storageSeed);
  const windowListeners = {};
  const documentListeners = {};
  const tableHooks = {};
  const fetchCalls = [];
  let reloadCount = 0;

  const table = {
    name: "collapsibles",
    hook(name, fn) {
      tableHooks[name] = fn;
    },
  };

  const context = {
    console,
    Blob,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb) => cb(),
    navigator: { onLine: online },
    localStorage,
    history: { replaceState: () => {} },
    location: {
      origin: "http://localhost",
      pathname: "/book",
      search: "",
      hash: "",
      reload: () => {
        reloadCount += 1;
      },
    },
    close: () => {},
    addEventListener(name, fn) {
      windowListeners[name] = windowListeners[name] || [];
      windowListeners[name].push(fn);
    },
    dispatchWindowEvent(name, event = {}) {
      const fns = windowListeners[name] || [];
      for (const fn of fns) {
        fn(event);
      }
    },
    document: {
      hidden: false,
      addEventListener(name, fn) {
        documentListeners[name] = documentListeners[name] || [];
        documentListeners[name].push(fn);
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({
        setAttribute: () => {},
        removeAttribute: () => {},
        addEventListener: () => {},
        toggleAttribute: () => {},
        closest: () => null,
        classList: { add: () => {}, remove: () => {} },
        style: {},
      }),
      body: { prepend: () => {} },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return fetchImpl(url, options);
    },
    atob: (value) => Buffer.from(value, "base64").toString("utf8"),
    btoa: (value) => Buffer.from(value, "utf8").toString("base64"),
    HYPERBOOK_CLOUD: { id: "test", url: "http://cloud.local" },
    hyperbook: {
      i18n: { get: (_k, _m, fallback) => fallback || "" },
      store: {
        db: {
          tables: [table],
          export: async () =>
            new Blob([
              JSON.stringify({
                formatName: "dexie",
                formatVersion: 1,
                data: { tables: [] },
              }),
            ], { type: "application/json" }),
          import: async () => {},
        },
      },
    },
  };

  context.window = context;

  localStorage.setItem(
    AUTH_TOKEN_KEY,
    createToken({ id: 1, username: "student1", readonly: false }),
  );

  const script = fs.readFileSync(CLOUD_JS_PATH, "utf8");
  vm.runInNewContext(script, context);

  return {
    context,
    localStorage,
    fetchCalls,
    getReloadCount: () => reloadCount,
    async waitForSyncHooks() {
      for (let i = 0; i < 50; i++) {
        if (typeof tableHooks.creating === "function") {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      throw new Error("Sync hooks were not registered");
    },
    triggerCreateEvent(data = { id: "s1", collapsed: false }) {
      tableHooks.creating("s1", data);
    },
  };
}

function jsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return payload;
    },
  };
}

describe("cloud sync conflict/offline flows", () => {
  it("resolves event conflict via snapshot without reload", async () => {
    const sandbox = createSandbox({
      online: true,
      storageSeed: {},
      fetchImpl: async (url) => {
        if (url.endsWith("/api/store/test")) {
          return jsonResponse(404, { error: "No store data found" });
        }
        if (url.endsWith("/api/store/test/events")) {
          return jsonResponse(409, { error: "Stale state" });
        }
        if (url.endsWith("/api/store/test/snapshot")) {
          return jsonResponse(200, { lastEventId: 0, stateChecksum: "checksum-1" });
        }
        return jsonResponse(500, { error: "Unexpected request" });
      },
    });

    await sandbox.waitForSyncHooks();
    sandbox.triggerCreateEvent();
    await sandbox.context.hyperbook.cloud.save();

    const eventCalls = sandbox.fetchCalls.filter((c) => c.url.endsWith("/events"));
    const snapshotCalls = sandbox.fetchCalls.filter((c) => c.url.endsWith("/snapshot"));

    expect(eventCalls.length).toBe(1);
    expect(snapshotCalls.length).toBe(1);
    expect(sandbox.getReloadCount()).toBe(0);
  });

  it("persists offline queue and flushes on reconnect without reload", async () => {
    const firstLoad = createSandbox({
      online: false,
      storageSeed: {},
      fetchImpl: async (url) => {
        if (url.endsWith("/api/store/test")) {
          return jsonResponse(404, { error: "No store data found" });
        }
        return jsonResponse(500, { error: "Unexpected request while offline" });
      },
    });

    await firstLoad.waitForSyncHooks();
    firstLoad.triggerCreateEvent();
    await firstLoad.context.hyperbook.cloud.save();

    const persisted = firstLoad.localStorage.getItem(OFFLINE_QUEUE_KEY);
    expect(persisted).toBeTruthy();
    expect(JSON.parse(persisted).length).toBeGreaterThan(0);

    const secondLoad = createSandbox({
      online: true,
      storageSeed: firstLoad.localStorage._dump(),
      fetchImpl: async (url) => {
        if (url.endsWith("/api/store/test")) {
          return jsonResponse(404, { error: "No store data found" });
        }
        if (url.endsWith("/api/store/test/events")) {
          return jsonResponse(200, { lastEventId: 1, stateChecksum: "checksum-2" });
        }
        return jsonResponse(500, { error: "Unexpected request" });
      },
    });

    await secondLoad.waitForSyncHooks();
    secondLoad.context.dispatchWindowEvent("online");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const eventCalls = secondLoad.fetchCalls.filter((c) => c.url.endsWith("/events"));
    expect(eventCalls.length).toBeGreaterThan(0);
    expect(secondLoad.getReloadCount()).toBe(0);
    expect(secondLoad.localStorage.getItem(OFFLINE_QUEUE_KEY)).toBe("[]");
  });
});
