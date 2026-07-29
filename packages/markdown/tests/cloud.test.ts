import { describe, it, expect } from "vitest";
import { createHarness, clientEvent, readonlyToken } from "./cloudHarness";

// Exercises the client half of the cloud sync in assets/cloud.js: the pending
// queue, the per-hyperbook watermark, offline batching and conflict recovery.

/** Drop the debounce so performSave runs straight through. */
function immediate(sync: any) {
  sync.minSaveInterval = 0;
  return sync;
}

function eventRequests(requests: any[]) {
  return requests.filter((r) => r.url.endsWith("/events"));
}

describe("watermark storage", () => {
  it("namespaces the watermark per hyperbook", async () => {
    const a = await createHarness({ hyperbookId: "book-a" });
    immediate(a.sync);
    a.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await a.sync.performSave();

    expect(a.localStorage.get("hyperbook_last_event_id:book-a")).toBe("1");
    expect(a.localStorage.has("hyperbook_last_event_id")).toBe(false);
  });

  it("keeps two hyperbooks on the same origin from colliding", async () => {
    // A single global key made each book send the other's afterEventId, which
    // the server answered with a permanent 409.
    const shared = {
      "hyperbook_last_event_id:book-a": "7",
      "hyperbook_last_event_id:book-b": "42",
    };

    const a = await createHarness({ hyperbookId: "book-a", storage: shared });
    const b = await createHarness({ hyperbookId: "book-b", storage: shared });

    expect(a.sync.lastEventId).toBe(7);
    expect(b.sync.lastEventId).toBe(42);
  });

  it("migrates a watermark left by the pre-namespacing version", async () => {
    const h = await createHarness({
      hyperbookId: "book-a",
      storage: { hyperbook_last_event_id: "13" },
    });

    expect(h.sync.lastEventId).toBe(13);
    expect(h.localStorage.get("hyperbook_last_event_id:book-a")).toBe("13");
    expect(h.localStorage.has("hyperbook_last_event_id")).toBe(false);
  });
});

describe("sending events", () => {
  it("sends the queue and advances the watermark", async () => {
    const h = await createHarness({ respond: () => ({ lastEventId: 4 }) });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    const [req] = eventRequests(h.requests);
    expect(req.body.events).toHaveLength(1);
    expect(req.body.afterEventId).toBe(0);
    expect(h.sync.lastEventId).toBe(4);
    expect(h.sync.isDirty).toBe(false);
  });

  it("sends the primary-key schema with each event", async () => {
    // The server needs it to replay onto a table it has no snapshot for.
    const h = await createHarness({ tables: { bookmarks: "path" } });
    immediate(h.sync);

    h.sync.addEvent(
      clientEvent("bookmarks", "create", "/a", { path: "/a" }, "path"),
    );
    await h.sync.performSave();

    expect(eventRequests(h.requests)[0].body.events[0].schema).toBe("path");
  });

  it("keeps events that arrive while the request is in flight", async () => {
    let release: (v: unknown) => void;
    const gate = new Promise((r) => (release = r));

    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) return { lastEventId: 1 };
        return { lastEventId: 0 };
      },
    });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));

    const original = h.sync.sendEvents.bind(h.sync);
    h.sync.sendEvents = async (events: any[], opts: any) => {
      await gate;
      return original(events, opts);
    };

    const saving = h.sync.performSave();
    // Let performSave capture its batch and reach the gated request first.
    await new Promise((r) => setTimeout(r, 0));
    h.sync.addEvent(clientEvent("consent", "create", 2, { id: 2 }));
    release!(null);
    await saving;

    // The in-flight batch is gone, the newcomer survives.
    expect(h.sync.pendingEvents).toHaveLength(1);
    expect(h.sync.pendingEvents[0].primKey).toBe(2);
  });

  it("does not send an empty batch", async () => {
    const h = await createHarness();
    immediate(h.sync);

    await h.sync.performSave();

    expect(eventRequests(h.requests)).toHaveLength(0);
  });

  it("drops a batch the server rejects with a 4xx", async () => {
    // A malformed batch is never going to be accepted; retrying it forever
    // would pin the queue and block every later change.
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          throw { status: 400, body: { error: "invalid operation" } };
        }
        return { lastEventId: 0 };
      },
    });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.sync.pendingEvents).toHaveLength(0);
    expect(h.sync.retryCount).toBe(0);
  });

  it("keeps a batch the server fails with a 5xx", async () => {
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          throw { status: 500, body: { error: "boom" } };
        }
        return { lastEventId: 0 };
      },
    });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.sync.pendingEvents).toHaveLength(1);
    expect(h.sync.retryCount).toBeGreaterThan(0);
  });

  it("treats a 404 as terminal rather than crashing on a null body", async () => {
    // A 404 makes apiRequest return null; reading .lastEventId off it used to
    // throw a TypeError that the loop retried forever.
    const h = await createHarness({ respond: () => undefined });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.sync.pendingEvents).toHaveLength(0);
  });
});

describe("snapshots", () => {
  it("excludes ephemeral tables from the snapshot export", async () => {
    // currentState (cursor position, scroll) is skipped by the event hooks, so
    // shipping it in snapshots pushed local UI state to other sessions.
    const h = await createHarness({
      tables: { consent: "id", currentState: "id" },
      respond: () => ({ lastEventId: 0 }),
    });

    await h.cloud.sendSnapshot();

    const filter = h.exportOptions.at(-1).filter;
    expect(filter("consent")).toBe(true);
    expect(filter("currentState")).toBe(false);
  });

  it("adopts the watermark the snapshot response reports", async () => {
    const h = await createHarness({ respond: () => ({ lastEventId: 0 }) });

    h.sync.lastEventId = 99;
    await h.cloud.sendSnapshot();

    expect(h.sync.lastEventId).toBe(0);
    expect(h.localStorage.get("hyperbook_last_event_id:test")).toBe("0");
  });
});

describe("offline queue", () => {
  it("queues instead of sending while offline", async () => {
    const h = await createHarness({ online: false });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(eventRequests(h.requests)).toHaveLength(0);
    expect(h.sync.offlineQueue).toHaveLength(1);
    expect(h.sync.pendingEvents).toHaveLength(0);
  });

  it("chains queued batches onto the watermark each one returns", async () => {
    // The watermark cannot advance while offline, so recording afterEventId at
    // enqueue time made every batch after the first arrive stale and 409.
    let nextId = 0;
    const h = await createHarness({
      online: false,
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          if (req.body.afterEventId !== nextId) {
            throw { status: 409, body: { serverLastEventId: nextId } };
          }
          nextId += req.body.events.length;
          return { lastEventId: nextId };
        }
        return { lastEventId: nextId };
      },
    });
    immediate(h.sync);

    for (const key of [1, 2, 3]) {
      h.sync.addEvent(clientEvent("consent", "create", key, { id: key }));
      await h.sync.performSave();
    }
    expect(h.sync.offlineQueue).toHaveLength(3);

    h.goOnline();
    await h.sync.processOfflineQueue();

    const sent = eventRequests(h.requests);
    expect(sent.map((r) => r.body.afterEventId)).toEqual([0, 1, 2]);
    expect(h.sync.offlineQueue).toHaveLength(0);
    expect(h.sync.lastEventId).toBe(3);
  });

  it("keeps the unsent tail when a queued batch fails", async () => {
    let calls = 0;
    const h = await createHarness({
      online: false,
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          calls++;
          if (calls === 2) throw { status: 500, body: {} };
          return { lastEventId: calls };
        }
        return { lastEventId: 0 };
      },
    });
    immediate(h.sync);

    for (const key of [1, 2, 3]) {
      h.sync.addEvent(clientEvent("consent", "create", key, { id: key }));
      await h.sync.performSave();
    }

    h.goOnline();
    await h.sync.processOfflineQueue();

    expect(h.sync.offlineQueue).toHaveLength(2);
  });

  it("collapses an overflowing queue into a single snapshot", async () => {
    const h = await createHarness({
      online: false,
      respond: () => ({ lastEventId: 0 }),
    });
    immediate(h.sync);

    for (let i = 0; i < 101; i++) {
      h.sync.addEvent(clientEvent("consent", "create", i, { id: i }));
      await h.sync.performSave();
    }

    expect(h.sync.offlineQueue).toHaveLength(1);
    expect(h.sync.offlineQueue[0].snapshot).toBe(true);

    h.goOnline();
    await h.sync.processOfflineQueue();

    expect(h.requests.some((r) => r.url.endsWith("/snapshot"))).toBe(true);
    expect(h.sync.offlineQueue).toHaveLength(0);
  });
});

describe("conflict recovery", () => {
  it("re-sends the pending batch instead of discarding it", async () => {
    // The old behaviour re-fetched and reloaded, throwing away everything the
    // user had done since the last successful save.
    let serverWatermark = 5;
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          if (req.body.afterEventId !== serverWatermark) {
            throw { status: 409, body: { serverLastEventId: serverWatermark } };
          }
          serverWatermark += req.body.events.length;
          return { lastEventId: serverWatermark };
        }
        return {
          snapshot: {
            version: 1,
            data: { hyperbook: { formatName: "dexie", data: { tables: [] } } },
          },
          lastEventId: serverWatermark,
        };
      },
    });
    immediate(h.sync);

    h.sync.lastEventId = 0; // stale
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1, v: "mine" }));
    await h.sync.performSave();

    const sent = eventRequests(h.requests);
    expect(sent).toHaveLength(2);
    expect(sent[0].body.afterEventId).toBe(0); // rejected
    expect(sent[1].body.afterEventId).toBe(5); // retried at the fetched mark
    expect(sent[1].body.events[0].data).toEqual({ id: 1, v: "mine" });
    expect(h.sync.pendingEvents).toHaveLength(0);
    expect(h.sync.lastEventId).toBe(6);
  });

  it("pulls the server state and replays the pending events on top of it", async () => {
    let serverWatermark = 5;
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          if (req.body.afterEventId !== serverWatermark) {
            throw { status: 409, body: { serverLastEventId: serverWatermark } };
          }
          serverWatermark += req.body.events.length;
          return { lastEventId: serverWatermark };
        }
        return {
          snapshot: {
            version: 1,
            data: { hyperbook: { formatName: "dexie", data: { tables: [] } } },
          },
          lastEventId: serverWatermark,
        };
      },
    });
    immediate(h.sync);

    h.sync.lastEventId = 0;
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1, v: "mine" }));
    await h.sync.performSave();

    // Server state was imported, then our own change re-applied locally.
    expect(h.imports.at(-1).opts.clearTablesBeforeImport).toBe(true);
    expect(h.table("consent").rows.get("1")).toEqual({ id: 1, v: "mine" });
    // The reload is announced first and deferred; see "merge notice".
    expect(h.runTimers(4000)).toBe(1);
    expect(h.reloads).toBe(1);
  });

  it("does not reload while a change made during the merge is still unsent", async () => {
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events")) {
          throw { status: 409, body: { serverLastEventId: 5 } };
        }
        return {
          snapshot: {
            version: 1,
            data: { hyperbook: { formatName: "dexie", data: { tables: [] } } },
          },
          lastEventId: 5,
        };
      },
    });
    immediate(h.sync);

    h.sync.lastEventId = 0;
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    // Every attempt conflicts, so nothing is lost and no reload happens.
    expect(h.sync.pendingEvents).toHaveLength(1);
    expect(h.reloads).toBe(0);
  });
});

describe("read-only (impersonation) sessions", () => {
  it("does not start a sync manager", async () => {
    const h = await createHarness({
      storage: { hyperbook_auth_token: readonlyToken() },
    });

    expect(h.sync).toBeNull();
  });

  it("sends nothing to the cloud", async () => {
    const h = await createHarness({
      storage: { hyperbook_auth_token: readonlyToken() },
    });

    await h.cloud.save();
    await h.cloud.sendSnapshot();

    expect(eventRequests(h.requests)).toHaveLength(0);
    expect(h.requests.some((r) => r.url.endsWith("/snapshot"))).toBe(false);
  });
});

describe("flushing on unload", () => {
  it("sends pending events with keepalive when the tab closes", async () => {
    // The debounce is up to 2s wide, so before this a tab closed mid-window
    // dropped everything typed in it — beforeunload only warned.
    const h = await createHarness();
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));

    h.fire("beforeunload", { preventDefault: () => {}, returnValue: "" });

    const sent = eventRequests(h.requests);
    expect(sent).toHaveLength(1);
    expect(sent[0].keepalive).toBe(true);
    expect(sent[0].body.events).toHaveLength(1);
    expect(sent[0].body.afterEventId).toBe(h.sync.lastEventId);
    expect(sent[0].headers.Authorization).toMatch(/^Bearer /);
  });

  it("flushes on pagehide, which fires where beforeunload does not", async () => {
    const h = await createHarness();
    h.sync.addEvent(clientEvent("bookmarks", "create", "/a", { path: "/a" }));

    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(1);
  });

  it("flushes once when both unload events fire", async () => {
    const h = await createHarness();
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));

    h.fire("beforeunload", { preventDefault: () => {}, returnValue: "" });
    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(1);
  });

  it("flushes again after the user cancels the unload and keeps editing", async () => {
    const h = await createHarness();
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    h.fire("beforeunload", { preventDefault: () => {}, returnValue: "" });

    h.sync.addEvent(clientEvent("consent", "update", 1, { id: 1, v: 2 }));
    h.fire("beforeunload", { preventDefault: () => {}, returnValue: "" });

    const sent = eventRequests(h.requests);
    expect(sent).toHaveLength(2);
    expect(sent[1].body.events).toHaveLength(2);
  });

  it("still warns the user, since the flush cannot be confirmed", async () => {
    const h = await createHarness();
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));

    let prevented = false;
    const event = {
      preventDefault: () => void (prevented = true),
      returnValue: "",
    };
    h.fire("beforeunload", event);

    expect(prevented).toBe(true);
  });

  it("sends nothing when there is nothing pending", async () => {
    const h = await createHarness();

    h.fire("beforeunload", { preventDefault: () => {}, returnValue: "" });
    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(0);
  });

  it("sends nothing while offline, so the batch stays queued", async () => {
    const h = await createHarness({ online: false });
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));

    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(0);
    expect(h.sync.pendingEvents).toHaveLength(1);
  });

  it("sends nothing in a read-only session", async () => {
    const h = await createHarness({
      storage: { hyperbook_auth_token: readonlyToken() },
    });

    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(0);
  });

  it("skips a batch over the keepalive budget rather than losing it", async () => {
    // Browsers reject an oversized keepalive body outright; attempting it would
    // drop the batch just as surely as not trying.
    const h = await createHarness();
    h.sync.addEvent(
      clientEvent("typst", "update", 1, {
        id: 1,
        source: "x".repeat(70 * 1024),
      }),
    );

    h.fire("pagehide");

    expect(eventRequests(h.requests)).toHaveLength(0);
    expect(h.sync.pendingEvents).toHaveLength(1);
  });

  it("leaves the pending queue intact, since delivery is unconfirmed", async () => {
    const h = await createHarness();
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    const before = h.sync.lastEventId;

    h.fire("pagehide");

    expect(h.sync.pendingEvents).toHaveLength(1);
    expect(h.sync.lastEventId).toBe(before);
  });
});

describe("sync indicator", () => {
  /** The data-state the toolbar icon is showing. */
  function iconState(h: any) {
    return h.ui.icon.getAttribute("data-state");
  }

  it("gives each state its own icon shape, not just a colour", async () => {
    // Every state used to render the identical person glyph, distinguished
    // only by fill — invisible to a red-green colour blind reader.
    const h = await createHarness();
    const seen = new Set<string>();

    h.sync.updateUI("unsaved");
    seen.add(iconState(h));
    h.sync.updateUI("saving");
    seen.add(iconState(h));
    h.sync.updateUI("saved");
    seen.add(iconState(h));
    h.sync.updateUI("error");
    seen.add(iconState(h));
    h.sync.updateUI("offline");
    seen.add(iconState(h));

    expect(seen).toEqual(
      new Set(["pending", "syncing", "synced", "error", "offline"]),
    );
  });

  it("names the toolbar button after the current state", async () => {
    // The icon is the only ambient indicator; without this a screen reader
    // announces "User, button" no matter what sync is doing.
    const h = await createHarness();

    h.sync.updateUI("saving");
    expect(h.ui.toggle.getAttribute("aria-label")).toBe("Saving...");
    expect(h.ui.toggle.getAttribute("title")).toBe("Saving...");

    h.sync.updateUI("error");
    expect(h.ui.toggle.getAttribute("aria-label")).toBe("Save Error");
  });

  it("says how many batches are waiting while offline", async () => {
    // "Saved locally" on its own reads as "you're all done".
    const h = await createHarness({ online: false });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();
    h.sync.addEvent(clientEvent("consent", "create", 2, { id: 2 }));
    await h.sync.performSave();

    expect(h.ui.status.textContent).toBe("Saved locally (2 waiting to sync)");
  });

  it("reports how long ago the last save landed", async () => {
    const h = await createHarness();
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();
    expect(h.ui.status.textContent).toBe("Saved (just now)");

    h.sync.lastSaveTime = Date.now() - 5 * 60_000;
    h.sync.updateUI("saved");
    expect(h.ui.status.textContent).toBe("Saved (5 min ago)");

    h.sync.lastSaveTime = Date.now() - 3 * 3_600_000;
    h.sync.updateUI("saved");
    expect(h.ui.status.textContent).toBe("Saved (3 h ago)");
  });

  it("updates the icon even when the drawer markup is absent", async () => {
    // updateUserIconState used to sit behind an early return on the status
    // element, freezing the toolbar icon in shells without a user drawer.
    const h = await createHarness({ withDrawer: false });
    expect(h.ui.status).toBeNull();

    h.sync.updateUI("saved");
    expect(iconState(h)).toBe("synced");
    expect(h.ui.toggle.getAttribute("aria-label")).toBe("Saved");
  });

  it("ignores a state it has no presentation for", async () => {
    const h = await createHarness();
    h.sync.updateUI("saved");

    h.sync.updateUI("not-a-real-state");

    expect(iconState(h)).toBe("synced");
    expect(h.ui.status.textContent).toBe("Saved");
  });
});

describe("ambient sync notice", () => {
  /** Set up a session whose next save fails with the given status. */
  async function failing(status: number) {
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events") && req.method === "POST") {
          throw { status, body: { error: "nope" } };
        }
        return { lastEventId: 1 };
      },
    });
    immediate(h.sync);
    return h;
  }

  it("surfaces a failed save outside the drawer", async () => {
    // The status line lives inside the user drawer. Until a reader opens it,
    // the toolbar badge was the only sign anything had gone wrong.
    const h = await failing(500);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.ui.notice).not.toBeNull();
    expect(h.ui.notice.className).toBe("error");
    expect(h.ui.notice.textContent).toContain("Could not save to the cloud");
  });

  it("offers a retry that actually re-sends", async () => {
    const h = await failing(500);
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    const before = h.requests.length;
    const button = h.ui.notice.children.find(
      (c: any) => c.tagName === "button",
    );
    expect(button.textContent).toBe("Retry");

    button.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(h.requests.length).toBeGreaterThan(before);
  });

  it("explains what happens to changes made offline", async () => {
    const h = await createHarness({ online: false });
    immediate(h.sync);

    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.ui.notice.className).toBe("warning");
    expect(h.ui.notice.textContent).toContain("kept on this device");
    expect(h.ui.notice.textContent).toContain("1 waiting to sync");
  });

  it("clears itself once the save succeeds", async () => {
    const h = await createHarness({ online: false });
    immediate(h.sync);
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();
    expect(h.ui.notice).not.toBeNull();

    h.goOnline();
    await h.sync.processOfflineQueue();
    h.sync.updateUI("saved");

    expect(h.ui.notice).toBeNull();
  });

  it("stays quiet for the states a reader cannot act on", async () => {
    const h = await createHarness();

    for (const state of ["unsaved", "saving", "saved", "readonly"]) {
      h.sync.updateUI(state);
      expect(h.ui.notice, `notice shown for "${state}"`).toBeNull();
    }
  });

  it("is announced politely rather than as an alert", async () => {
    // These states are worth surfacing but never worth interrupting a reader
    // mid-sentence for.
    const h = await createHarness({ online: false });
    immediate(h.sync);
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1 }));
    await h.sync.performSave();

    expect(h.ui.notice.getAttribute("role")).toBe("status");
    expect(h.ui.notice.getAttribute("aria-live")).toBe("polite");
  });
});

describe("merge notice", () => {
  /** A session whose first save conflicts, then succeeds. */
  async function conflicting() {
    let conflicted = false;
    const h = await createHarness({
      respond: (req) => {
        if (req.url.endsWith("/events") && req.method === "POST") {
          if (!conflicted) {
            conflicted = true;
            throw { status: 409, body: { serverLastEventId: 9 } };
          }
          return { lastEventId: 10 };
        }
        return { snapshot: { data: { hyperbook: {} } }, lastEventId: 9 };
      },
    });
    immediate(h.sync);
    h.sync.addEvent(clientEvent("consent", "create", 1, { id: 1, v: "mine" }));
    await h.sync.performSave();
    return h;
  }

  it("explains the merge instead of reloading without warning", async () => {
    // A conflict used to reload the instant it resolved, so the reader's page
    // changed under them with nothing said about why.
    const h = await conflicting();

    expect(h.ui.notice).not.toBeNull();
    expect(h.ui.notice.className).toBe("info");
    expect(h.ui.notice.textContent).toContain("another session");
    expect(h.reloads).toBe(0);
  });

  it("reloads on its own shortly afterwards", async () => {
    const h = await conflicting();

    expect(h.runTimers(4000)).toBe(1);
    expect(h.reloads).toBe(1);
  });

  it("lets the reader reload immediately", async () => {
    const h = await conflicting();

    const button = h.ui.notice.children.find(
      (c: any) => c.tagName === "button",
    );
    expect(button.textContent).toBe("Reload now");
    button.click();

    expect(h.reloads).toBe(1);
  });

  it("is not cleared by a save that finishes before the reload", async () => {
    const h = await conflicting();

    h.sync.updateUI("saved");

    expect(h.ui.notice).not.toBeNull();
    expect(h.ui.notice.textContent).toContain("another session");
  });
});
