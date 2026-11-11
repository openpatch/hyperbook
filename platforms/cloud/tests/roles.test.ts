import { describe, expect, it } from "vitest";
import { createAdminApi } from "../src/server/admin/app";
import { loggedIn, setup } from "./helpers";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const commenter = await loggedIn(instance, { email: "c@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const listing = (await owner.c.post(`/api/books/${book.id}/files/init`, { template: "empty" })).body;
  await owner.c.post(`/api/books/${book.id}/members`, { email: "c@example.org", role: "commenter" });
  return { instance, owner, commenter, book, listing };
}

/**
 * The book routes a commenter may use, as "METHOD path" with the API's own
 * parameter names. Every other route under /books/:id must refuse them.
 */
const COMMENTER_ROUTES = new Set([
  "GET /books/:id",
  "GET /books/:id/files",
  "GET /books/:id/files/language",
  "GET /books/:id/files/references",
  "GET /books/:id/files/raw",
  "GET /books/:id/files/texts",
  "POST /books/:id/files/render",
  "POST /books/:id/files/typst-preview",
  "GET /books/:id/typst-packages",
  "POST /books/:id/preview-code",
  "GET /books/:id/history",
  "GET /books/:id/history/live-diff",
  "GET /books/:id/history/:sha/diff",
  "GET /books/:id/dictionary",
]);

/** Routes whose own checks are tested elsewhere (comments, links). */
const SEPARATE = /^\/books\/:id\/(comments|links)\b/;

describe("commenter role", () => {
  it("is refused on every book route but the reading ones", async () => {
    const { instance, commenter, book } = await world();
    const routes = createAdminApi(instance.deps)
      .routes.filter((r) => r.path.startsWith("/books/:id") && r.method !== "ALL")
      .filter((r) => !SEPARATE.test(r.path));
    const seen = new Set<string>();
    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url =
        "/api" +
        route.path
          .replace(":id", String(book.id))
          .replace(/:[a-zA-Z]+/g, "1");
      const res = await commenter.c.raw(route.method, url, route.method === "GET" ? undefined : {});
      if (COMMENTER_ROUTES.has(key)) {
        expect([200, 400, 404, 409, 422], key).toContain(res.status);
        if (res.status === 404 && !route.path.includes(":sha"))
          throw new Error(`${key} answered 404 to a commenter`);
      } else {
        // 400: the empty body failed validation before the role check, which
        // is fine; the real bodies below reach the check.
        expect([400, 403, 404], `${key} answered ${res.status}`).toContain(res.status);
      }
    }
    // Every route the allowlist names exists.
    for (const key of COMMENTER_ROUTES) expect(seen, key).toContain(key);
  });

  it("reads files and history, but never saves", async () => {
    const { commenter, book, listing } = await world();
    const base = `/api/books/${book.id}`;
    expect((await commenter.c.get(`${base}/files`)).status).toBe(200);
    expect((await commenter.c.get(`${base}/files/raw?path=book/index.md`)).status).toBe(200);
    expect((await commenter.c.get(`${base}/history`)).status).toBe(200);
    expect((await commenter.c.get(base)).body.role).toBe("commenter");

    const oid = listing.files.find((f: { path: string }) => f.path === "book/index.md").oid;
    const save = await commenter.c.post(`${base}/files/commit`, {
      changes: [{ op: "write", path: "book/index.md", content: "# Mine", baseOid: oid }],
    });
    expect(save.status).toBe(403);
    expect((await commenter.c.post(`${base}/dictionary`, { word: "Kraftwerk" })).status).toBe(403);
    expect((await commenter.c.post(`${base}/groups`, { name: "7b" })).status).toBe(403);
    expect((await commenter.c.get(`${base}/groups`)).status).toBe(403);
    expect((await commenter.c.post(`${base}/publish-request`, { note: "" })).status).toBe(403);
    expect((await commenter.c.post(`${base}/git/tokens`, { name: "laptop" })).status).toBe(403);
    expect((await commenter.c.patch(base, { title: "Mine" })).status).toBe(403);
    expect((await commenter.c.get(`${base}/members`)).status).toBe(403);
    expect((await commenter.c.post(`${base}/members`, { email: "x@example.org" })).status).toBe(403);
  });

  // Leaving is DELETE /members/:own id, refused for anyone else's (the table above).
  it("may leave the book, and only owners add commenters", async () => {
    const { instance, owner, commenter, book } = await world();
    const editor = await loggedIn(instance, { email: "e@example.org" });
    await loggedIn(instance, { email: "n@example.org" });
    await owner.c.post(`/api/books/${book.id}/members`, { email: "e@example.org" });
    expect(
      (await editor.c.post(`/api/books/${book.id}/members`, { email: "n@example.org", role: "commenter" })).status,
    ).toBe(403);
    const members = (await owner.c.get(`/api/books/${book.id}/members`)).body;
    expect(members.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual([
      ["c@example.org", "commenter"],
      ["e@example.org", "editor"],
      ["o@example.org", "owner"],
    ]);
    expect((await commenter.c.delete(`/api/books/${book.id}/members/${owner.user.id}`)).status).toBe(403);
    expect((await commenter.c.delete(`/api/books/${book.id}/members/${commenter.user.id}`)).status).toBe(200);
    expect((await commenter.c.get(`/api/books/${book.id}`)).status).toBe(404);
  });

  it("gets no git access, even with a personal token", async () => {
    const { instance, commenter, book } = await world();
    const token = (await commenter.c.post("/api/me/git-tokens", { label: "laptop" })).body.token as string;
    const res = await instance.app.request(`/api/books/${book.id}/git/info/refs?service=git-upload-pack`, {
      headers: {
        host: "admin.test",
        authorization: `Basic ${Buffer.from(`git:${token}`).toString("base64")}`,
      },
    });
    expect(res.status).toBe(401);
  });
});
