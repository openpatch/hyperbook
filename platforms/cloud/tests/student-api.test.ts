import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bookClient } from "./book-client";
import { loggedIn, setup } from "./helpers";

const HOST = "physics.books.test";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const group = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).body;
  const student = (
    await owner.c.post(`/api/groups/${group.id}/students`, { username: "ada", password: "secret-pass" })
  ).body;
  return { instance, owner, book, group, student };
}

const bookmark = (path: string) => ({
  table: "bookmarks",
  schema: "path,label",
  op: "create",
  primKey: path,
  data: { path, label: path },
});

describe("student login", () => {
  it("logs in with a password and keeps a cookie session", async () => {
    const { instance } = await world();
    const b = bookClient(instance, HOST);
    expect((await b.get("/_hyperbook/api/session")).status).toBe(401);
    const res = await b.post("/_hyperbook/api/login", { username: "Ada", password: "secret-pass" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { username: "ada" }, readonly: false });
    expect(res.setCookie).toMatch(/^__Host-hb_student=.+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect((await b.get("/_hyperbook/api/session")).body).toEqual({ user: { username: "ada" }, readonly: false });

    await b.post("/_hyperbook/api/logout");
    expect((await b.get("/_hyperbook/api/session")).status).toBe(401);
  });

  it("makes a browser-session cookie on shared devices", async () => {
    const { instance } = await world();
    const b = bookClient(instance, HOST);
    const res = await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass", sharedDevice: true });
    expect(res.setCookie).not.toMatch(/Max-Age/);
  });

  it("refuses wrong passwords and stops guessing", async () => {
    const { instance } = await world();
    const b = bookClient(instance, HOST);
    for (let i = 0; i < 10; i++) {
      expect((await b.post("/_hyperbook/api/login", { username: "ada", password: "nope" })).status).toBe(401);
    }
    expect((await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(429);
  });

  it("logs in with the QR code's key", async () => {
    const { instance, owner, group } = await world();
    const creds = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body;
    const key = new URL(creds.students[0].loginUrl).hash.replace("#k=", "");
    const b = bookClient(instance, HOST);
    expect((await b.post("/_hyperbook/api/login/key", { key: "wrong" })).status).toBe(401);
    const res = await b.post("/_hyperbook/api/login/key", { key });
    expect(res.body.user.username).toBe("ada");
    expect((await b.get("/_hyperbook/api/session")).status).toBe(200);
  });

  it("refuses requests from other origins, such as a sibling book", async () => {
    const { instance } = await world();
    const sibling = bookClient(instance, HOST, { origin: "http://evil.books.test" });
    expect((await sibling.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(403);
    const noOrigin = bookClient(instance, HOST, { origin: null });
    expect((await noOrigin.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(403);
  });

  it("does not accept a session in another book", async () => {
    const { instance, owner } = await world();
    await owner.c.post("/api/books", { title: "Chemistry", slug: "chemistry" });
    const b = bookClient(instance, HOST);
    await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
    const res = await instance.app.request("/_hyperbook/api/session", {
      headers: { host: "chemistry.books.test", cookie: b.cookie },
    });
    expect(res.status).toBe(401);
  });

  it("ends sessions when the teacher sets a new password or login code", async () => {
    const { instance, owner, student } = await world();
    const b = bookClient(instance, HOST);
    await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
    await owner.c.put(`/api/students/${student.id}/password`, { password: "new-secret" });
    expect((await b.get("/_hyperbook/api/session")).status).toBe(401);
    await b.post("/_hyperbook/api/login", { username: "ada", password: "new-secret" });
    await owner.c.post(`/api/students/${student.id}/login-key/regenerate`);
    expect((await b.get("/_hyperbook/api/session")).status).toBe(401);
  });

  it("ends sessions when the student is deleted", async () => {
    const { instance, owner, student } = await world();
    const b = bookClient(instance, HOST);
    await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
    await owner.c.delete(`/api/students/${student.id}`);
    expect((await b.get("/_hyperbook/api/session")).status).toBe(401);
  });
});

describe("student store", () => {
  async function loggedInStudent() {
    const w = await world();
    const b = bookClient(w.instance, HOST);
    await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
    return { ...w, b };
  }

  it("saves events and returns the rebuilt state", async () => {
    const { b } = await loggedInStudent();
    expect((await b.get("/_hyperbook/api/store")).body).toMatchObject({ snapshot: null, lastEventId: 0 });
    const saved = await b.post("/_hyperbook/api/store/events", { events: [bookmark("/a")], afterEventId: 0 });
    expect(saved.body).toEqual({ success: true, lastEventId: 1 });
    const state = (await b.get("/_hyperbook/api/store")).body;
    expect(state.lastEventId).toBe(1);
    const rows = state.snapshot.data.hyperbook.data.data.find((d: any) => d.tableName === "bookmarks").rows;
    expect(rows).toEqual([{ path: "/a", label: "/a" }]);
  });

  it("answers a stale watermark with 409", async () => {
    const { b } = await loggedInStudent();
    await b.post("/_hyperbook/api/store/events", { events: [bookmark("/a")], afterEventId: 0 });
    const res = await b.post("/_hyperbook/api/store/events", { events: [bookmark("/b")], afterEventId: 0 });
    expect(res.status).toBe(409);
    expect(res.body.serverLastEventId).toBe(1);
  });

  it("refuses malformed batches with 400", async () => {
    const { b } = await loggedInStudent();
    expect((await b.post("/_hyperbook/api/store/events", { events: [] })).status).toBe(400);
    const bad = await b.post("/_hyperbook/api/store/events", { events: [{ table: "t", op: "drop", primKey: 1 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/invalid operation/);
  });

  it("replaces the state with a snapshot", async () => {
    const { b } = await loggedInStudent();
    const data = { version: 1, data: { hyperbook: { formatName: "dexie", data: { tables: [], data: [] } } } };
    expect((await b.post("/_hyperbook/api/store/snapshot", { data })).body).toEqual({ success: true, lastEventId: 1 });
    expect((await b.post("/_hyperbook/api/store/snapshot", { data: "nope" })).status).toBe(400);
  });

  it("needs a session", async () => {
    const { instance } = await world();
    const b = bookClient(instance, HOST);
    expect((await b.get("/_hyperbook/api/store")).status).toBe(401);
    expect((await b.post("/_hyperbook/api/store/events", { events: [bookmark("/a")] })).status).toBe(401);
  });
});

describe("books hosted elsewhere", () => {
  const EXTERNAL = "https://teacher.github.io";

  async function external() {
    const w = await world();
    await w.owner.c.patch(`/api/books/${w.book.id}`, { externalUrl: `${EXTERNAL}/physics/` });
    return w;
  }

  it("logs in with a Bearer token through CORS for the book's own site only", async () => {
    const { instance } = await external();
    const site = bookClient(instance, HOST, { origin: EXTERNAL });

    const preflight = await instance.app.request("/_hyperbook/api/store/events", {
      method: "OPTIONS",
      headers: { host: HOST, origin: EXTERNAL, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(EXTERNAL);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const login = await site.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass", token: true });
    expect(login.status).toBe(200);
    expect(login.setCookie).toBeNull();
    expect(login.headers.get("access-control-allow-origin")).toBe(EXTERNAL);
    const auth = { authorization: `Bearer ${login.body.token}` };

    const saved = await site.post("/_hyperbook/api/store/events", { events: [bookmark("/a")], afterEventId: 0 }, auth);
    expect(saved.body.lastEventId).toBe(1);
    expect((await site.get("/_hyperbook/api/session", auth)).body.user.username).toBe("ada");

    // Another site gets no CORS headers, so its page cannot read anything.
    const other = await instance.app.request("/_hyperbook/api/session", {
      headers: { host: HOST, origin: "https://evil.example", ...auth },
    });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not accept a token as a cookie or a cookie session as a token", async () => {
    const { instance } = await external();
    const site = bookClient(instance, HOST, { origin: EXTERNAL });
    const { token } = (await site.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass", token: true })).body;
    const asCookie = await instance.app.request("/_hyperbook/api/session", {
      headers: { host: HOST, cookie: `__Host-hb_student=${token}` },
    });
    expect(asCookie.status).toBe(401);
  });
});

describe("private books", () => {
  it("are readable after logging in", async () => {
    const { instance, owner, book } = await world();
    const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    await admin.c.patch(`/api/books/${book.id}`, { visibility: "private" });
    await owner.c.upload(
      `/api/books/${book.id}/source`,
      zipSync({ "hyperbook.json": new TextEncoder().encode("{}"), "index.html": new TextEncoder().encode("<h1>Secret</h1>") }),
    );
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();

    const b = bookClient(instance, HOST);
    expect((await b.get("/")).status).toBe(302);
    const page = await b.get("/_hyperbook/login?next=/");
    expect(page.status).toBe(200);
    expect(page.body).toContain("Physics");

    await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
    const res = await b.get("/");
    expect(res.status).toBe(200);
    expect(res.body).toBe("<h1>Secret</h1>");
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
  });
});
