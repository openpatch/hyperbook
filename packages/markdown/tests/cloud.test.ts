import { describe, expect, it } from "vitest";
import { FakeCloud, openPage, readyPage } from "./cloudHarness";

/*
 * cloud.js keeps a student's store in sync with Hyperbook Cloud. These tests
 * run it against real Dexie (fake-indexeddb) and an in-memory server that
 * speaks the platform's store protocol, page load by page load.
 */

const bookmark = (path: string, label = path) => ({ path, label });
const uploads = (cloud: FakeCloud) => cloud.requests.filter((r) => r.method === "POST" && r.url.endsWith("/store"));
/** The rows of an upload without when they changed and what they were based on. */
const rowsOf = (request: { body: any }) =>
  request.body.rows.map(({ table, key, data }: any) => ({ table, key, data }));

/** A student who already synced on this device, with saved work on the server. */
async function returningStudent() {
  const cloud = new FakeCloud();
  const first = await readyPage({ cloud });
  await first.db.table("bookmarks").put(bookmark("/a"));
  await first.tick(1000);
  return { cloud, page: first };
}

describe("first sync on a device", () => {
  it("replaces whatever the device held with the student's saved work, then reloads", async () => {
    const cloud = new FakeCloud();
    cloud.upload([{ table: "bookmarks", key: "/saved", data: bookmark("/saved") }]);
    cloud.loggedIn = false;
    const page = await openPage({ cloud, loggedIn: false });
    await page.ready();
    // Used without logging in first.
    await page.db.table("bookmarks").put(bookmark("/anonymous"));
    expect(uploads(cloud)).toEqual([]);

    cloud.loggedIn = true;
    const loggedIn = await page.reopen({ loggedIn: true });
    expect(await loggedIn.db.table("bookmarks").toArray()).toEqual([bookmark("/saved")]);
    expect(loggedIn.reloads).toBe(1);
    expect(loggedIn.sync).toMatchObject({ student: "ada", revision: 1, dirty: {} });

    // The reloaded page has nothing new to fetch and does not reload again.
    const after = await loggedIn.reopen();
    expect(after.reloads).toBe(0);
    expect(uploads(cloud)).toEqual([]);
  });

  it("does not reload when there was nothing to replace", async () => {
    const page = await readyPage({ cloud: new FakeCloud() });
    expect(page.reloads).toBe(0);
    expect(page.sync).toMatchObject({ student: "ada", revision: 0 });
  });

  it("starts over when another student logs in on the device", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("bookmarks").put(bookmark("/unsent"));

    const other = new FakeCloud();
    other.username = "max";
    other.upload([{ table: "bookmarks", key: "/max", data: bookmark("/max") }]);
    page.storage.set("hyperbook_auth_user:cloud", JSON.stringify({ username: "max", readonly: false }));
    page.db.close();
    const next = await readyPage({ cloud: other, name: page.name, storage: page.storage });

    expect(await next.db.table("bookmarks").toArray()).toEqual([bookmark("/max")]);
    expect(next.sync).toMatchObject({ student: "max", dirty: {} });
    expect(uploads(other)).toEqual([]);
    expect(cloud.saved("bookmarks")).toEqual({ '"/a"': bookmark("/a") });
  });
});

describe("saving changes", () => {
  it("marks a change at once and uploads it after a pause", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "q1", text: "4" });

    expect(Object.keys(page.sync.dirty)).toEqual(['textinput\u0000"q1"']);
    expect(page.status).toBe("unsaved");
    expect(uploads(cloud)).toEqual([]);

    await page.tick(1000);
    expect(uploads(cloud)).toHaveLength(1);
    expect(uploads(cloud)[0].body).toEqual({
      since: 0,
      rows: [{ table: "textinput", key: "q1", data: { id: "q1", text: "4" }, at: expect.any(Number), base: 0 }],
      replace: false,
    });
    expect(page.sync).toMatchObject({ revision: 1, dirty: {} });
    expect(page.status).toBe("saved");
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "4" } });
  });

  it("uploads while typing at the latest after five seconds", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    for (let i = 0; i < 6; i++) {
      await page.db.table("textinput").put({ id: "q1", text: "x".repeat(i + 1) });
      await page.tick(900);
    }
    expect(uploads(cloud)).toHaveLength(1);
  });

  it("uploads the current value, once, for many changes to one row", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    for (const text of ["1", "12", "123"]) await page.db.table("textinput").put({ id: "q1", text });
    await page.tick(1000);
    expect(rowsOf(uploads(cloud)[0])).toEqual([{ table: "textinput", key: "q1", data: { id: "q1", text: "123" } }]);
  });

  it("uploads updates and deletions", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("bookmarks").update("/a", { label: "renamed" });
    await page.tick(1000);
    expect(cloud.saved("bookmarks")).toEqual({ '"/a"': bookmark("/a", "renamed") });
    await page.db.table("bookmarks").delete("/a");
    await page.tick(1000);
    expect(cloud.saved("bookmarks")).toEqual({});
  });

  it("does not count a write that changes nothing", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("bookmarks").put(bookmark("/a"));
    expect(page.sync.dirty).toEqual({});
    await page.tick(5000);
    expect(uploads(cloud)).toHaveLength(1);
  });

  it("never uploads the cursor and scroll state", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("currentState").put({ id: 1, scrollY: 300 });
    await page.tick(5000);
    expect(page.sync.dirty).toEqual({});
    expect(uploads(cloud)).toEqual([]);
  });

  it("keeps compound keys intact", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("pairs").put({ a: "x", b: 1, v: "pair" });
    await page.tick(1000);
    expect(rowsOf(uploads(cloud)[0])).toEqual([{ table: "pairs", key: ["x", 1], data: { a: "x", b: 1, v: "pair" } }]);

    const phone = await readyPage({ cloud });
    expect(await phone.db.table("pairs").get(["x", 1])).toEqual({ a: "x", b: 1, v: "pair" });
  });

  it("keeps a change made while an upload is in flight", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "q1", text: "a" });
    cloud.hold();
    await page.tick(1000);
    await page.db.table("textinput").put({ id: "q1", text: "ab" });
    cloud.release();
    await page.settle();

    // The upload carried "a"; "ab" is still marked and goes next.
    expect(Object.keys(page.sync.dirty)).toEqual(['textinput\u0000"q1"']);
    await page.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "ab" } });
    expect(page.sync.dirty).toEqual({});
  });

  it("tracks what elements write while the page is still starting", async () => {
    const { cloud, page } = await returningStudent();
    page.db.close();
    cloud.hold();
    const next = await openPage({ cloud, name: page.name, storage: page.storage });
    // Before the session check and download have answered.
    await next.db.table("bookmarks").put(bookmark("/early"));
    cloud.release();
    await next.ready();
    await next.tick(1000);
    expect(cloud.saved("bookmarks")).toHaveProperty('"/early"');
  });
});

describe("compression", () => {
  const program = "for i in range(10):\n    print(i * i)\n".repeat(400);

  it("sends large uploads gzip-compressed", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "big", text: program });
    await page.tick(1000);
    // Compressing takes real time, which the fake clock does not wait for.
    await page.internal().scheduler.running;

    const sent = uploads(cloud)[0];
    expect(sent.headers["Content-Encoding"]).toBe("gzip");
    expect(sent.size).toBeLessThan(program.length / 10);
    expect(cloud.saved("textinput")).toEqual({ '"big"': { id: "big", text: program } });
  });

  it("sends small uploads as plain JSON", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    await page.tick(1000);
    expect(uploads(cloud)[0].headers["Content-Encoding"]).toBeUndefined();
  });

  it("sends plain JSON where the browser cannot compress", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud, noCompression: true });
    await page.db.table("textinput").put({ id: "big", text: program });
    await page.tick(1000);
    expect(uploads(cloud)[0].headers["Content-Encoding"]).toBeUndefined();
    expect(cloud.saved("textinput")).toHaveProperty('"big"');
  });
});

describe("leaving the page", () => {
  it("never asks whether to leave", async () => {
    const page = await readyPage({ cloud: new FakeCloud() });
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    const event = { preventDefault: () => expect.fail("must not prevent unloading"), returnValue: undefined };
    page.fire("beforeunload", event);
    expect(event.returnValue).toBeUndefined();
  });

  it("uploads what the next page finds still marked, without overwriting it first", async () => {
    // The bug that started this: switching a tab, then following a link
    // within the upload delay.
    const { cloud, page } = await returningStudent();
    await page.db.table("textinput").put({ id: "q1", text: "unsent" });
    const next = await page.reopen();

    expect(await next.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "unsent" });
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "unsent" } });
    expect(next.sync.dirty).toEqual({});
    expect(next.reloads).toBe(0);
  });

  it("sends the marked rows with keepalive when the page is hidden", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    page.fire("pagehide");
    await page.settle();
    const sent = uploads(cloud).find((r) => r.keepalive)!;
    expect(rowsOf(sent)).toEqual([{ table: "textinput", key: "q1", data: { id: "q1", text: "4" } }]);
    // Delivery is not confirmed, so the mark stays for the next page.
    expect(Object.keys(page.sync.dirty)).toHaveLength(1);
  });

  it("sends a row's merged value after an update with keepalive", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("bookmarks").update("/a", { label: "new" });
    page.fire("pagehide");
    await page.settle();
    expect(rowsOf(uploads(cloud).find((r) => r.keepalive)!)).toEqual([
      { table: "bookmarks", key: "/a", data: bookmark("/a", "new") },
    ]);
  });

  it("leaves keepalive out when it would exceed the browser's budget", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "big", text: "x".repeat(70 * 1024) });
    page.fire("pagehide");
    await page.settle();
    expect(uploads(cloud).filter((r) => r.keepalive)).toEqual([]);
  });

  it("uploads right away when the tab is hidden", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    page.hide();
    await page.settle();
    expect(cloud.saved("textinput")).toHaveProperty('"q1"');
  });
});

describe("offline and failures", () => {
  it("keeps changes made offline across page loads and uploads them once back", async () => {
    const { cloud, page } = await returningStudent();
    page.setOnline(false);
    await page.db.table("textinput").put({ id: "q1", text: "offline" });
    await page.tick(1000);
    expect(page.status).toBe("offline");
    expect(page.notice.textContent).toMatch(/Offline/);

    const next = await page.reopen({ online: false });
    expect(await next.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "offline" });
    next.setOnline(true);
    await next.settle();
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "offline" } });
    expect(next.sync.dirty).toEqual({});
    expect(next.status).toBe("saved");
  });

  it("retries a server error with growing pauses", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    cloud.failures = [500, 502];
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    await page.tick(1000);
    expect(page.status).toBe("error");
    expect(page.notice.textContent).toMatch(/Could not save/);
    await page.tick(1000);
    expect(uploads(cloud)).toHaveLength(2);
    await page.tick(1999);
    expect(uploads(cloud)).toHaveLength(2);
    await page.tick(1);
    expect(uploads(cloud)).toHaveLength(3);
    expect(cloud.saved("textinput")).toHaveProperty('"q1"');
    expect(page.status).toBe("saved");
    expect(page.notice).toBeNull();
  });

  it("does not retry a refused upload in a loop, and keeps it marked", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud });
    cloud.failures = [413];
    await page.db.table("textinput").put({ id: "q1", text: "huge" });
    await page.tick(60_000);
    expect(uploads(cloud)).toHaveLength(1);
    expect(page.status).toBe("error");
    expect(Object.keys(page.sync.dirty)).toHaveLength(1);

    // "Retry" in the notice tries again.
    page.notice.children.find((c: any) => c.tagName === "button").click();
    await page.settle();
    expect(cloud.saved("textinput")).toHaveProperty('"q1"');
  });

  it("keeps the marks when the session ended, and uploads them after logging in again", async () => {
    const { cloud, page } = await returningStudent();
    cloud.loggedIn = false;
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    await page.tick(1000);
    expect(page.sync.dirty).not.toEqual({});

    cloud.loggedIn = true;
    page.storage.set("hyperbook_auth_user:cloud", JSON.stringify({ username: "ada", readonly: false }));
    const next = await page.reopen();
    expect(cloud.saved("textinput")).toHaveProperty('"q1"');
    expect(next.sync.dirty).toEqual({});
  });
});

describe("several devices", () => {
  it("brings another device's work in on the next page load, and reloads to show it", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "from the laptop" } }]);
    const next = await page.reopen();
    expect(await next.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "from the laptop" });
    expect(next.reloads).toBe(1);
    expect(cloud.requests.at(-1)!.url).toMatch(/\/store\?since=1$/);
  });

  it("applies deletions from another device", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([{ table: "bookmarks", key: "/a", data: null }]);
    const next = await page.reopen();
    expect(await next.db.table("bookmarks").toArray()).toEqual([]);
  });

  it("never overwrites a row changed while the download was on its way", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([
      { table: "textinput", key: "q1", data: { id: "q1", text: "theirs" } },
      { table: "bookmarks", key: "/b", data: bookmark("/b") },
    ]);
    cloud.hold();
    const download = page.api.save();
    await page.settle();
    await page.db.table("textinput").put({ id: "q1", text: "mine" });
    cloud.release();
    await download;

    expect(await page.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "mine" });
    expect(await page.db.table("bookmarks").get("/b")).toEqual(bookmark("/b"));
    await page.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "mine" } });
  });

  it("uploads its own row over another device's older upload of it", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "theirs" } }]);
    await page.db.table("textinput").put({ id: "q1", text: "mine" });
    await page.tick(1000);
    expect(await page.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "mine" });
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "mine" } });
  });

  it("offers a reload instead of reloading under a reader who is working", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([{ table: "bookmarks", key: "/b", data: bookmark("/b") }]);
    await page.db.table("textinput").put({ id: "q1", text: "typing" });
    await page.tick(1000);
    expect(page.reloads).toBe(0);
    expect(page.notice.textContent).toMatch(/another device/);
    page.notice.children.find((c: any) => c.tagName === "button").click();
    expect(page.reloads).toBe(1);
  });

  it("lets the change made later win over another device's older change", async () => {
    const { cloud, page } = await returningStudent();
    // The school computer changes a row and goes offline for a week.
    page.setOnline(false);
    await page.db.table("textinput").put({ id: "q1", text: "at school" });
    // Meanwhile the student goes on at home.
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "at home" } }], Date.now() + 60_000);

    // Back at school: the newer work at home stays, and comes to school.
    page.setOnline(true);
    await page.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "at home" } });
    expect(await page.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "at home" });
    expect(page.sync.dirty).toEqual({});
  });

  it("uploads a change made later over another device's older change", async () => {
    const { cloud, page } = await returningStudent();
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "theirs" } }], Date.now() - 60_000);
    // Not downloaded yet: this device never saw "theirs".
    page.setOnline(false);
    await page.db.table("textinput").put({ id: "q1", text: "mine" });
    page.setOnline(true);
    await page.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "mine" } });
  });
});

describe("several tabs of one device", () => {
  it("keeps the marks of both tabs when they change rows at the same time", async () => {
    const cloud = new FakeCloud();
    const one = await readyPage({ cloud });
    const two = await one.openTab();
    await Promise.all([
      one.db.table("textinput").put({ id: "q1", text: "one" }),
      two.db.table("textinput").put({ id: "q2", text: "two" }),
    ]);
    expect(Object.keys(one.sync.dirty).sort()).toEqual(['textinput\u0000"q1"', 'textinput\u0000"q2"']);

    await one.tick(1000);
    expect(cloud.saved("textinput")).toEqual({
      '"q1"': { id: "q1", text: "one" },
      '"q2"': { id: "q2", text: "two" },
    });
    expect(one.sync.dirty).toEqual({});
  });

  it("keeps a change another tab made while an upload was in flight", async () => {
    const cloud = new FakeCloud();
    const one = await readyPage({ cloud });
    const two = await one.openTab();
    await one.db.table("textinput").put({ id: "q1", text: "first" });
    cloud.hold();
    const upload = one.api.save();
    await one.settle();
    await two.db.table("textinput").put({ id: "q1", text: "second" });
    cloud.release();
    await upload;

    expect(Object.keys(one.sync.dirty)).toEqual(['textinput\u0000"q1"']);
    await two.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "second" } });
    expect(one.sync.dirty).toEqual({});
  });

  it("takes turns: two tabs never upload at the same time", async () => {
    const cloud = new FakeCloud();
    const one = await readyPage({ cloud });
    const two = await one.openTab();
    await one.db.table("textinput").put({ id: "q1", text: "one" });
    await two.db.table("textinput").put({ id: "q2", text: "two" });
    cloud.hold();
    const first = one.api.save();
    const second = two.api.save();
    await one.settle();
    // The second tab waits for the first one's answer.
    expect(uploads(cloud)).toHaveLength(1);
    cloud.release();
    await first;
    await one.settle();
    cloud.release();
    await second;
    expect(uploads(cloud).length).toBeLessThanOrEqual(2);
    expect(one.sync).toMatchObject({ revision: cloud.revision, dirty: {} });
  });

  it("does not overwrite a change another tab made while a download was on its way", async () => {
    const cloud = new FakeCloud();
    const one = await readyPage({ cloud });
    const two = await one.openTab();
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "theirs" } }], Date.now() - 60_000);
    cloud.hold();
    const download = one.api.save();
    await one.settle();
    await two.db.table("textinput").put({ id: "q1", text: "mine" });
    cloud.release();
    await download;
    expect(await one.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "mine" });
    await two.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"q1"': { id: "q1", text: "mine" } });
  });
});

describe("changes racing a download", () => {
  it("keeps a change another tab starts as the answer arrives", async () => {
    const cloud = new FakeCloud();
    const one = await readyPage({ cloud });
    const two = await one.openTab();
    cloud.upload([{ table: "textinput", key: "q1", data: { id: "q1", text: "theirs" } }], Date.now() - 60_000);
    let typing: Promise<unknown> | null = null;
    cloud.onAnswer = () => {
      cloud.onAnswer = null;
      typing = two.db.table("textinput").put({ id: "q1", text: "mine" });
    };
    await one.api.save();
    await typing;
    await one.settle();
    expect(await one.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "mine" });
  });
});

describe("large uploads", () => {
  it("uploads a large backlog in batches the server takes", async () => {
    const cloud = new FakeCloud();
    cloud.maxRows = 600;
    const page = await readyPage({ cloud });
    page.setOnline(false);
    await page.db.table("textinput").bulkPut(Array.from({ length: 1200 }, (_, i) => ({ id: `q${i}`, text: "x" })));
    page.setOnline(true);
    // Large enough to be compressed, which takes real time.
    await page.api.save();
    expect(uploads(cloud).every((r) => r.body.rows.length <= 500)).toBe(true);
    expect(Object.keys(cloud.saved("textinput"))).toHaveLength(1200);
    expect(page.sync.dirty).toEqual({});
    expect(page.status).toBe("saved");
  });

  it("sets a refused row aside and uploads the others", async () => {
    const cloud = new FakeCloud();
    cloud.refuse = (row) => row.key === "huge";
    const page = await readyPage({ cloud });
    page.setOnline(false);
    await page.db.table("textinput").bulkPut([
      { id: "a", text: "1" },
      { id: "huge", text: "too much" },
      { id: "b", text: "2" },
    ]);
    page.setOnline(true);
    await page.tick(1000);
    expect(cloud.saved("textinput")).toEqual({ '"a"': { id: "a", text: "1" }, '"b"': { id: "b", text: "2" } });
    expect(Object.keys(page.sync.dirty)).toEqual(['textinput\u0000"huge"']);
    expect(page.status).toBe("error");

    // Later changes to other rows go through without retrying it.
    const before = uploads(cloud).length;
    await page.db.table("textinput").put({ id: "c", text: "3" });
    await page.tick(1000);
    expect(uploads(cloud).slice(before).map((r) => rowsOf(r).map((row: any) => row.key))).toEqual([["c"]]);
    expect(cloud.saved("textinput")).toHaveProperty('"c"');
    expect(page.status).toBe("error");

    // Once the row is small enough, a change uploads it.
    cloud.refuse = null;
    await page.db.table("textinput").put({ id: "huge", text: "less" });
    await page.tick(1000);
    expect(cloud.saved("textinput")).toHaveProperty('"huge"');
    expect(page.status).toBe("saved");
  });

  it("replaces the saved state in batches", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("textinput").bulkPut(Array.from({ length: 1100 }, (_, i) => ({ id: `q${i}`, text: "x" })));
    await page.db.table("bookmarks").clear();
    await page.api.replaceAll();
    await page.settle();
    const replacing = uploads(cloud).filter((r) => r.body.replace);
    expect(replacing).toHaveLength(1);
    expect(Object.keys(cloud.saved("textinput"))).toHaveLength(1100);
    expect(cloud.saved("bookmarks")).toEqual({});
    expect(page.sync).toMatchObject({ replace: false, dirty: {} });
  });
});

describe("importing and resetting", () => {
  it("replaces the saved state with the whole local store", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("bookmarks").clear();
    await page.db.table("bookmarks").put(bookmark("/imported"));
    await page.api.replaceAll();
    await page.settle();

    const last = uploads(cloud).at(-1)!;
    expect(last.body.replace).toBe(true);
    expect(rowsOf(last)).toEqual([{ table: "bookmarks", key: "/imported", data: bookmark("/imported") }]);
    expect(cloud.saved("bookmarks")).toEqual({ '"/imported"': bookmark("/imported") });
    expect(page.sync).toMatchObject({ dirty: {}, replace: false });
  });

  it("keeps the replacement pending while offline", async () => {
    const { cloud, page } = await returningStudent();
    page.setOnline(false);
    await page.db.table("bookmarks").clear();
    await page.api.replaceAll();
    expect(page.sync.replace).toBe(true);

    const next = await page.reopen();
    expect(cloud.saved("bookmarks")).toEqual({});
    expect(next.sync.replace).toBe(false);
  });
});

describe("logging out", () => {
  it("uploads first, then empties the device", async () => {
    const { cloud, page } = await returningStudent();
    await page.db.table("textinput").put({ id: "q1", text: "last words" });
    await page.api.logout();
    expect(cloud.saved("textinput")).toHaveProperty('"q1"');
    expect(await page.db.table("bookmarks").toArray()).toEqual([]);
    expect(page.sync).toBeNull();
    expect(page.storage.has("hyperbook_auth_user:cloud")).toBe(false);
    expect(cloud.requests.some((r) => r.url.endsWith("/logout"))).toBe(true);
    expect(page.reloads).toBe(1);
  });

  it("asks before losing work that could not be uploaded", async () => {
    const { page } = await returningStudent();
    page.setOnline(false);
    await page.db.table("textinput").put({ id: "q1", text: "unsent" });

    page.answer(true, false);
    await page.api.logout();
    expect(page.confirms[1]).toMatch(/could not be uploaded/);
    // Stays logged in, with the work and its mark.
    expect(await page.db.table("textinput").get("q1")).toEqual({ id: "q1", text: "unsent" });
    expect(Object.keys(page.sync.dirty)).toHaveLength(1);
    expect(page.reloads).toBe(0);
  });
});

describe("a teacher's read-only view", () => {
  it("shows the student's saved work and uploads nothing", async () => {
    const cloud = new FakeCloud();
    cloud.readonly = true;
    cloud.upload([{ table: "bookmarks", key: "/a", data: bookmark("/a") }]);
    const page = await readyPage({ cloud });
    expect(await page.db.table("bookmarks").toArray()).toEqual([bookmark("/a")]);
    expect(page.status).toBe("readonly");
    expect(page.sync.student).toBe("view:ada");

    await page.db.table("bookmarks").put(bookmark("/teacher"));
    await page.tick(10_000);
    expect(uploads(cloud)).toEqual([]);
    expect(page.sync.dirty).toEqual({});
  });

  it("is replaced by the student's own state when the student logs in later", async () => {
    const cloud = new FakeCloud();
    cloud.readonly = true;
    const view = await readyPage({ cloud });
    await view.db.table("bookmarks").put(bookmark("/teacher"));

    cloud.readonly = false;
    view.storage.set("hyperbook_auth_user:cloud", JSON.stringify({ username: "ada", readonly: false }));
    const student = await view.reopen();
    expect(await student.db.table("bookmarks").toArray()).toEqual([]);
    expect(uploads(cloud)).toEqual([]);
  });

  it("empties the device when the teacher leaves the view", async () => {
    const cloud = new FakeCloud();
    cloud.readonly = true;
    cloud.upload([{ table: "bookmarks", key: "/a", data: bookmark("/a") }]);
    const page = await readyPage({ cloud });
    page.elements["exit-impersonation"].click();
    await page.settle();
    expect(await page.db.table("bookmarks").toArray()).toEqual([]);
    expect(page.sync).toBeNull();
  });
});

describe("books hosted elsewhere", () => {
  it("talks to the platform with the Bearer token", async () => {
    const cloud = new FakeCloud();
    const page = await readyPage({ cloud, sameOrigin: false });
    await page.db.table("textinput").put({ id: "q1", text: "4" });
    await page.tick(1000);
    const sent = uploads(cloud)[0];
    expect(sent.url).toBe("https://physics.books.example.org/_hyperbook/api/store");
    expect(sent.headers.Authorization).toBe("Bearer token-1");
  });

  it("logs in with the key of a scanned QR code and loads the saved work", async () => {
    const cloud = new FakeCloud();
    cloud.upload([{ table: "bookmarks", key: "/a", data: bookmark("/a") }]);
    const page = await openPage({ cloud, sameOrigin: false, loggedIn: false, hash: "#hyperbook-key=abc" });
    await page.ready();
    expect(cloud.requests.some((r) => r.url.endsWith("/login/key") && r.body.key === "abc")).toBe(true);
    expect(page.storage.get("hyperbook_auth_token:physics")).toBe("token-new");
    expect(await page.db.table("bookmarks").toArray()).toEqual([bookmark("/a")]);
    expect(page.reloads).toBe(1);
  });
});
