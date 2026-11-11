import { describe, expect, it } from "vitest";
import { bookClient } from "./book-client";
import { client, loggedIn, setup } from "./helpers";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Olivia" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const listing = (await owner.c.post(`/api/books/${book.id}/files/init`, { template: "empty" })).body;
  const base = `/api/books/${book.id}`;
  /** A browser that opened a new link of `role`. */
  const visit = async (name: string, role: "commenter" | "editor") => {
    const created = (await owner.c.post(`${base}/links`, { name, role })).body;
    const token = new URL(created.url).hash.slice("#t=".length);
    const browser = client(instance);
    const res = await browser.post("/api/links/redeem", { token });
    return { browser, link: created, token, res };
  };
  const oidOf = (files: { path: string; oid: string }[], path: string) => files.find((f) => f.path === path)!.oid;
  return { instance, owner, book, base, listing, visit, oidOf };
}

describe("access links", () => {
  it("are made, listed and shown again by owners only", async () => {
    const { instance, owner, base } = await world();
    const created = await owner.c.post(`${base}/links`, { name: "Anna", role: "commenter" });
    expect(created.status).toBe(200);
    expect(created.body.url).toMatch(/^http:\/\/admin\.test\/join#t=[\w-]{43}$/);
    expect((await owner.c.get(`${base}/links`)).body).toMatchObject([{ name: "Anna", role: "commenter", lastUsedAt: null }]);
    const again = await owner.c.get(`${base}/links/${created.body.id}/url`);
    expect(again.body.url).toBe(created.body.url);

    const editor = await loggedIn(instance, { email: "e@example.org" });
    await owner.c.post(`${base}/members`, { email: "e@example.org" });
    expect((await editor.c.post(`${base}/links`, { name: "Ben" })).status).toBe(403);
    expect((await editor.c.get(`${base}/links`)).status).toBe(403);
    expect((await owner.c.post(`${base}/links`, { name: " " })).status).toBe(400);
    expect((await owner.c.post(`${base}/links`, { name: "Old", expiresAt: Date.now() - 1000 })).status).toBe(400);
  });

  it("let a commenter read the book and nothing else", async () => {
    const { instance, owner, base, book, visit, listing, oidOf } = await world();
    const { browser, res } = await visit("Anna", "commenter");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookId: book.id, role: "commenter", name: "Anna" });
    expect(browser.cookies).toMatch(/__Host-hb_link=/);
    expect((await browser.get("/api/links/session")).body).toMatchObject({ bookTitle: "Physics", name: "Anna" });

    const me = await browser.get(base);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ role: "commenter", viewer: { kind: "link", name: "Anna", userId: null } });
    expect((await browser.get(`${base}/files`)).status).toBe(200);
    expect((await browser.get(`${base}/files/raw?path=book/index.md`)).status).toBe(200);
    expect((await browser.get(`${base}/history`)).status).toBe(200);
    expect((await browser.get(`${base}/dictionary`)).status).toBe(200);
    expect((await browser.post(`${base}/preview-code`)).status).toBe(200);

    const save = await browser.post(`${base}/files/commit`, {
      changes: [{ op: "write", path: "book/index.md", content: "# Mine", baseOid: oidOf(listing.files, "book/index.md") }],
    });
    expect(save.status).toBe(403);
    expect((await browser.post(`${base}/publish-request`, {})).status).toBe(403);
    // Everything that is not about reading this book needs an account.
    expect((await browser.get("/api/me")).status).toBe(401);
    expect((await browser.get("/api/books")).status).toBe(401);
    expect((await browser.get(`${base}/groups`)).status).toBe(401);
    expect((await browser.get(`${base}/members`)).status).toBe(401);
    expect((await browser.get(`${base}/links`)).status).toBe(401);
    expect((await browser.get(`${base}/head`)).status).toBe(403);
    expect((await browser.post(`${base}/ai/assist`, { prompt: "hi" })).status).toBe(401);
    expect((await browser.post(`${base}/git/tokens`, { label: "x" })).status).toBe(401);
    expect((await browser.patch(base, { title: "Mine" })).status).toBe(401);

    // Another book is not there for them.
    const other = (await owner.c.post("/api/books", { title: "Math", slug: "math" })).body;
    expect((await browser.get(`/api/books/${other.id}`)).status).toBe(404);
    expect((await browser.get(`/api/books/${other.id}/files`)).status).toBe(404);
    expect(instance).toBeTruthy();
  });

  it("let an editor save under the link's name and ask for publishing", async () => {
    const { instance, owner, base, visit, listing, oidOf } = await world();
    const { browser, link } = await visit("Ben", "editor");
    const save = await browser.post(`${base}/files/commit`, {
      changes: [{ op: "write", path: "book/index.md", content: "# Ben's", baseOid: oidOf(listing.files, "book/index.md") }],
    });
    expect(save.status).toBe(200);
    const history = (await owner.c.get(`${base}/history`)).body;
    expect(history.commits[0]).toMatchObject({ name: "Ben (link)", email: `link-${link.id}@admin.test` });

    expect((await browser.post(`${base}/dictionary`, { word: "kraftwerk" })).status).toBe(200);
    const asked = await browser.post(`${base}/publish-request`, { note: "Ready" });
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ by: "Ben", byId: null, note: "Ready" });
    expect((await owner.c.get(`${base}/head`)).body.request).toMatchObject({ by: "Ben" });
    expect(instance.mailer.sent).toMatchObject([{ to: "o@example.org" }]);
    expect(instance.mailer.sent[0]!.text).toContain("Ben asks you to publish");
    // They may take their own request back, but not publish.
    expect((await browser.post(`${base}/publish`, {})).status).toBe(401);
    expect((await browser.delete(`${base}/publish-request`)).status).toBe(200);
  });

  it("stop working at once when deleted or expired", async () => {
    const { instance, owner, base, visit } = await world();
    const { browser, link, token } = await visit("Anna", "commenter");
    const { url } = (await browser.post(`${base}/preview-code`)).body;
    const preview = bookClient(instance, "physics--preview.books.test");
    const code = new URLSearchParams(new URL(url).hash.slice(1)).get("c")!;
    expect((await preview.post("/_hyperbook/api/preview", { code })).status).toBe(200);
    expect((await preview.get("/")).status).toBe(200);

    expect((await owner.c.delete(`${base}/links/${link.id}`)).status).toBe(200);
    expect((await browser.get(base)).status).toBe(401);
    expect((await preview.get("/")).status).toBe(403);
    expect((await client(instance).post("/api/links/redeem", { token })).status).toBe(404);
    expect((await owner.c.get(`${base}/links`)).body).toEqual([]);
    expect((await owner.c.get(`${base}/links/${link.id}/url`)).status).toBe(404);

    // A link that expired lets nobody in either.
    const soon = (await owner.c.post(`${base}/links`, { name: "Cleo", expiresAt: Date.now() + 60_000 })).body;
    const later = new URL(soon.url).hash.slice("#t=".length);
    const { redeemLink } = await import("../src/server/domain/links");
    expect(redeemLink(instance.db, later, Date.now() + 120_000)).toBeNull();
    expect(redeemLink(instance.db, later)).not.toBeNull();
  });

  it("leave the session, and members keep acting as themselves", async () => {
    const { instance, owner, base, visit } = await world();
    const { browser } = await visit("Anna", "commenter");
    expect((await browser.post("/api/links/leave")).status).toBe(200);
    expect((await browser.get(base)).status).toBe(401);
    expect((await browser.get("/api/links/session")).body).toBeNull();

    // An owner who opens a link of their own book is still the owner.
    const created = (await owner.c.post(`${base}/links`, { name: "Test", role: "commenter" })).body;
    await owner.c.post("/api/links/redeem", { token: new URL(created.url).hash.slice("#t=".length) });
    expect((await owner.c.get(base)).body).toMatchObject({ role: "owner", viewer: { kind: "user" } });
    // A teacher of another book who opens it comments through the link.
    const teacher = await loggedIn(instance, { email: "t@example.org" });
    await teacher.c.post("/api/links/redeem", { token: new URL(created.url).hash.slice("#t=".length) });
    expect((await teacher.c.get(base)).body).toMatchObject({ role: "commenter", viewer: { kind: "link" } });
    expect((await teacher.c.get("/api/me")).status).toBe(200);
  });
});
