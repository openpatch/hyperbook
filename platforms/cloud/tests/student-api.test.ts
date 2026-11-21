import { zipSync } from "fflate";
import { gzipSync } from "node:zlib";
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

const bookmark = (path: string) => ({ table: "bookmarks", key: path, data: { path, label: path } });

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

  it("saves rows and returns them to another device", async () => {
    const { b } = await loggedInStudent();
    expect((await b.get("/_hyperbook/api/store")).body).toEqual({ revision: 0, rows: [] });
    const saved = await b.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/a")] });
    expect(saved.body).toEqual({ revision: 1, rows: [] });
    expect((await b.get("/_hyperbook/api/store")).body).toEqual({ revision: 1, rows: [bookmark("/a")] });
    expect((await b.get("/_hyperbook/api/store?since=1")).body).toEqual({ revision: 1, rows: [] });
  });

  it("accepts the same rows twice, and answers with what others saved", async () => {
    const { b } = await loggedInStudent();
    await b.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/a")] });
    // A device that has not seen revision 1 resends and catches up at once.
    const res = await b.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/b")] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revision: 2, rows: [bookmark("/a")] });
  });

  it("refuses malformed rows with 400", async () => {
    const { b } = await loggedInStudent();
    expect((await b.post("/_hyperbook/api/store", { rows: [] })).status).toBe(400);
    const bad = await b.post("/_hyperbook/api/store", { since: 0, rows: [{ table: "a b", key: 1, data: null }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/table name/);
  });

  it("replaces the whole state", async () => {
    const { b } = await loggedInStudent();
    await b.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/a")] });
    expect((await b.post("/_hyperbook/api/store", { since: 1, rows: [], replace: true })).body).toEqual({
      revision: 2,
      rows: [],
    });
    expect((await b.get("/_hyperbook/api/store")).body).toEqual({ revision: 2, rows: [] });
  });

  describe("gzip-compressed uploads", () => {
    async function send(w: Awaited<ReturnType<typeof loggedInStudent>>, body: Buffer | string, encoding?: string) {
      const res = await w.instance.app.request("/_hyperbook/api/store", {
        method: "POST",
        headers: {
          host: HOST,
          origin: `http://${HOST}`,
          cookie: w.b.cookie,
          "content-type": "application/json",
          ...(encoding && { "content-encoding": encoding }),
        },
        body: typeof body === "string" ? body : new Uint8Array(body),
      });
      return { status: res.status, body: await res.json() };
    }

    it("unpacks them", async () => {
      const w = await loggedInStudent();
      const rows = [{ table: "ide", key: "p1", data: { id: "p1", code: "print('hi')\n".repeat(2000) } }];
      const packed = gzipSync(JSON.stringify({ since: 0, rows }));
      expect(await send(w, packed, "gzip")).toEqual({ status: 200, body: { revision: 1, rows: [] } });
      expect((await w.b.get("/_hyperbook/api/store")).body.rows).toEqual(rows);
    });

    it("refuses one that unpacks to more than the limit", async () => {
      const w = await loggedInStudent();
      // About 10 KB packed, 20 MB unpacked.
      const bomb = gzipSync(JSON.stringify({ since: 0, rows: [{ table: "t", key: 1, data: { x: "a".repeat(20 * 1024 * 1024) } }] }));
      expect(bomb.length).toBeLessThan(100 * 1024);
      expect((await send(w, bomb, "gzip")).status).toBe(413);
      expect((await w.b.get("/_hyperbook/api/store")).body).toEqual({ revision: 0, rows: [] });
    });

    it("refuses broken data and unknown encodings", async () => {
      const w = await loggedInStudent();
      expect((await send(w, "not gzip", "gzip")).status).toBe(400);
      expect((await send(w, gzipSync("not json"), "gzip")).status).toBe(400);
      expect((await send(w, Buffer.from("x"), "br")).status).toBe(415);
    });
  });

  it("needs a session", async () => {
    const { instance } = await world();
    const b = bookClient(instance, HOST);
    expect((await b.get("/_hyperbook/api/store")).status).toBe(401);
    expect((await b.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/a")] })).status).toBe(401);
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

    const preflight = await instance.app.request("/_hyperbook/api/store", {
      method: "OPTIONS",
      headers: { host: HOST, origin: EXTERNAL, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(EXTERNAL);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Content-Encoding");
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const login = await site.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass", token: true });
    expect(login.status).toBe(200);
    expect(login.setCookie).toBeNull();
    expect(login.headers.get("access-control-allow-origin")).toBe(EXTERNAL);
    const auth = { authorization: `Bearer ${login.body.token}` };

    const saved = await site.post("/_hyperbook/api/store", { since: 0, rows: [bookmark("/a")] }, auth);
    expect(saved.body.revision).toBe(1);
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
