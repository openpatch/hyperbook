import { describe, expect, it } from "vitest";
import { bookSlugs } from "../src/server/db/schema";
import { loggedIn, setup } from "./helpers";

async function world() {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Owner" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics 7a", slug: "physics-7a" })
  ).body;
  return { instance, admin, owner, other, book };
}

describe("books", () => {
  it("creates a book with its owner and address", async () => {
    const { owner, book } = await world();
    expect(book).toMatchObject({
      title: "Physics 7a",
      slug: "physics-7a",
      visibility: "public",
      role: "owner",
      url: "http://physics-7a.books.test",
    });
    expect((await owner.c.get("/api/books")).body).toHaveLength(1);
  });

  it("hides books from users who are not members", async () => {
    const { other, admin, book } = await world();
    expect((await other.c.get("/api/books")).body).toEqual([]);
    expect((await other.c.get(`/api/books/${book.id}`)).status).toBe(404);
    expect((await other.c.patch(`/api/books/${book.id}`, { title: "Mine" })).status).toBe(404);
    expect((await admin.c.get(`/api/books/${book.id}`)).body.role).toBe("owner");
    expect((await admin.c.get("/api/books")).body).toHaveLength(1);
  });

  it("rejects taken, reserved and malformed addresses", async () => {
    const { owner, admin } = await world();
    const create = (slug: string) => owner.c.post("/api/books", { title: "T", slug });
    expect((await create("physics-7a")).status).toBe(409);
    expect((await create("www")).status).toBe(409);
    expect((await create("a--b")).status).toBe(400);
    expect((await create("-ab")).status).toBe(400);
    expect((await create("Has Space")).status).toBe(400);

    await admin.c.put("/api/instance", { reservedSlugs: ["school"] });
    expect((await create("school")).status).toBe(409);
    expect((await create("Chemistry")).body.slug).toBe("chemistry");
  });

  it("enforces the book limit", async () => {
    const { owner, admin } = await world();
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, { max_books: 1 });
    const res = await owner.c.post("/api/books", { title: "Second", slug: "second" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/at most 1 book/);
  });

  it("makes a book private only with the entitlement", async () => {
    const { owner, admin, book } = await world();
    const url = `/api/books/${book.id}`;
    expect((await owner.c.patch(url, { visibility: "private" })).status).toBe(403);
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, { private_books: true });
    expect((await owner.c.patch(url, { visibility: "private" })).body.visibility).toBe("private");
  });

  it("renames the address and keeps the old one as a redirect", async () => {
    const { instance, owner, book } = await world();
    const res = await owner.c.patch(`/api/books/${book.id}`, { slug: "physics-8a" });
    expect(res.body).toMatchObject({ slug: "physics-8a", url: "http://physics-8a.books.test" });
    expect(instance.db.select().from(bookSlugs).all()).toEqual([
      { oldSlug: "physics-7a", bookId: book.id },
    ]);
    // Another book may take the old address; the redirect is dropped then.
    const taken = await owner.c.post("/api/books", { title: "New", slug: "physics-7a" });
    expect(taken.status).toBe(200);
    expect(instance.db.select().from(bookSlugs).all()).toEqual([]);
  });

  it("points to a book hosted elsewhere", async () => {
    const { owner, book } = await world();
    const res = await owner.c.patch(`/api/books/${book.id}`, {
      externalUrl: "https://example.github.io/physics/",
    });
    expect(res.body).toMatchObject({ source: "external", url: "https://example.github.io/physics/" });
    const back = await owner.c.patch(`/api/books/${book.id}`, { externalUrl: null });
    expect(back.body).toMatchObject({ source: "hosted", url: "http://physics-7a.books.test" });
  });

  it("deletes a book", async () => {
    const { owner, book } = await world();
    expect((await owner.c.delete(`/api/books/${book.id}`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}`)).status).toBe(404);
  });
});

describe("members", () => {
  it("adds editors, who may edit but not change owner settings", async () => {
    const { owner, other, book } = await world();
    const added = await owner.c.post(`/api/books/${book.id}/members`, {
      email: "x@example.org",
    });
    expect(added.body.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual([
      ["o@example.org", "owner"],
      ["x@example.org", "editor"],
    ]);
    const url = `/api/books/${book.id}`;
    expect((await other.c.patch(url, { title: "Physics 7b" })).body.title).toBe("Physics 7b");
    expect((await other.c.patch(url, { slug: "elsewhere" })).status).toBe(403);
    expect((await other.c.delete(url)).status).toBe(403);
    expect((await other.c.post(`${url}/members`, { email: "a@example.org" })).status).toBe(403);
  });

  it("only adds existing accounts", async () => {
    const { owner, book } = await world();
    const res = await owner.c.post(`/api/books/${book.id}/members`, { email: "new@example.org" });
    expect(res.status).toBe(404);
  });

  it("keeps at least one owner", async () => {
    const { owner, other, book } = await world();
    const url = `/api/books/${book.id}/members`;
    expect((await owner.c.delete(`${url}/${owner.user.id}`)).status).toBe(400);
    expect(
      (await owner.c.patch(`${url}/${owner.user.id}`, { role: "editor" })).status,
    ).toBe(400);

    await owner.c.post(url, { email: "x@example.org", role: "owner" });
    expect((await owner.c.patch(`${url}/${owner.user.id}`, { role: "editor" })).status).toBe(200);
    // An editor may leave on their own.
    expect((await owner.c.delete(`${url}/${owner.user.id}`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}`)).status).toBe(404);
    expect((await other.c.get(`/api/books/${book.id}`)).body.role).toBe("owner");
  });

  it("blocks deleting a user who is a book's only owner", async () => {
    const { admin, owner } = await world();
    const res = await admin.c.delete(`/api/users/${owner.user.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/only owner of 1 book/);
  });
});
