import { describe, expect, it } from "vitest";
import { bookClient } from "./book-client";
import { loggedIn, setup } from "./helpers";

const HOST = "physics.books.test";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const group = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).body;
  const student = (
    await owner.c.post(`/api/groups/${group.id}/students`, { username: "ada", password: "secret-pass" })
  ).body;
  // Ada saves something.
  const ada = bookClient(instance, HOST);
  await ada.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" });
  await ada.post("/_hyperbook/api/store/events", {
    events: [{ table: "bookmarks", schema: "path", op: "create", primKey: "/a", data: { path: "/a" } }],
    afterEventId: 0,
  });
  return { instance, owner, other, book, group, student };
}

describe("teachers and students' work", () => {
  it("shows when a student last saved", async () => {
    const { owner, group } = await world();
    const [ada] = (await owner.c.get(`/api/groups/${group.id}/students`)).body;
    expect(ada.lastSavedAt).toBeGreaterThan(Date.now() - 60_000);
  });

  it("downloads a student's state", async () => {
    const { owner, other, student } = await world();
    const res = await owner.c.get(`/api/students/${student.id}/data`);
    expect(res.headers.get("content-disposition")).toContain("ada.json");
    expect(res.body).toMatchObject({ username: "ada", lastEventId: 1 });
    expect((await other.c.get(`/api/students/${student.id}/data`)).status).toBe(404);
  });

  it("opens a read-only view of a student's work through a one-time code", async () => {
    const { instance, owner, other, student } = await world();
    expect((await other.c.post(`/api/students/${student.id}/impersonate`)).status).toBe(404);

    const { url } = (await owner.c.post(`/api/students/${student.id}/impersonate`)).body;
    expect(url).toMatch(/^http:\/\/physics\.books\.test\/_hyperbook\/impersonate#c=/);
    const code = new URL(url).hash.slice(3);

    const teacher = bookClient(instance, HOST);
    expect((await teacher.get("/_hyperbook/impersonate")).status).toBe(200);
    const res = await teacher.post("/_hyperbook/api/impersonate", { code });
    expect(res.body).toEqual({ user: { username: "ada" }, readonly: true });
    expect(res.setCookie).toMatch(/Max-Age=3600/);

    expect((await teacher.get("/_hyperbook/api/session")).body).toEqual({ user: { username: "ada" }, readonly: true });
    expect((await teacher.get("/_hyperbook/api/store")).body.lastEventId).toBe(1);
    const write = await teacher.post("/_hyperbook/api/store/events", {
      events: [{ table: "bookmarks", op: "delete", primKey: "/a", data: null }],
      afterEventId: 1,
    });
    expect(write.status).toBe(403);

    // The code works once.
    expect((await bookClient(instance, HOST).post("/_hyperbook/api/impersonate", { code })).status).toBe(401);
  });

  it("hands a read-only token to books hosted elsewhere", async () => {
    const { instance, owner, book, student } = await world();
    await owner.c.patch(`/api/books/${book.id}`, { externalUrl: "https://teacher.github.io/physics/" });
    const { url } = (await owner.c.post(`/api/students/${student.id}/impersonate`)).body;
    expect(url).toMatch(/^https:\/\/teacher\.github\.io\/physics\/#hyperbook-impersonate=/);
    const token = url.split("=")[1];
    const res = await instance.app.request("/_hyperbook/api/session", {
      headers: { host: HOST, authorization: `Bearer ${token}` },
    });
    expect(await res.json()).toEqual({ user: { username: "ada" }, readonly: true });
  });

  it("prints QR codes that open books hosted elsewhere", async () => {
    const { owner, book, group } = await world();
    await owner.c.patch(`/api/books/${book.id}`, { externalUrl: "https://teacher.github.io/physics/" });
    const creds = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body;
    expect(creds.students[0].loginUrl).toMatch(/^https:\/\/teacher\.github\.io\/physics\/#hyperbook-key=/);
  });
});
