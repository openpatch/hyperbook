import { describe, expect, it } from "vitest";
import { bookClient } from "./book-client";
import { loggedIn, setup } from "./helpers";

const PREVIEW = "physics--preview.books.test";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  await owner.c.post(`/api/books/${book.id}/files/init`, { template: "empty" });
  await instance.builds.idle();
  return { instance, owner, other, book };
}

/** The editor's hand-off: a code from the admin API, redeemed on the preview host. */
async function openPreview(instance: Awaited<ReturnType<typeof world>>["instance"], url: string) {
  const code = new URLSearchParams(new URL(url).hash.slice(1)).get("c")!;
  const browser = bookClient(instance, PREVIEW);
  const res = await browser.post("/_hyperbook/api/preview", { code });
  return { browser, res };
}

describe("preview host", () => {
  it("shows the newest save to the book's teachers after a hand-off", async () => {
    const { instance, owner, book } = await world();
    const { url } = (await owner.c.post(`/api/books/${book.id}/preview-code`)).body;
    expect(url).toMatch(/^http:\/\/physics--preview\.books\.test\/_hyperbook\/preview#c=/);

    const stranger = bookClient(instance, PREVIEW);
    expect((await stranger.get("/")).status).toBe(403);
    expect((await stranger.get("/_hyperbook/preview")).status).toBe(200);

    const { browser, res } = await openPreview(instance, url);
    expect(res.status).toBe(200);
    expect(res.setCookie).toMatch(/SameSite=None/i);
    expect(res.setCookie).toMatch(/Partitioned/i);
    expect(res.setCookie).toMatch(/HttpOnly/i);
    expect((await browser.get("/_hyperbook/api/preview")).status).toBe(200);
    // Pages render as they are visited (the test renderer shows their source).
    const page = await browser.get("/");
    expect(page.status).toBe(200);
    expect(page.body).toContain("# Physics");
    expect(page.body).toContain("hb-preview-scroll:");
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(page.headers.get("x-robots-tag")).toBe("noindex");

    // Codes work once.
    expect((await openPreview(instance, url)).res.status).toBe(401);
  });

  it("follows saves while the published book stays as it is", async () => {
    const { instance, owner, book } = await world();
    const listing = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    const oid = listing.files.find((f: { path: string }) => f.path === "book/index.md").oid;
    await owner.c.post(`/api/books/${book.id}/publish`);
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/files/commit`, {
      changes: [
        { op: "write", path: "book/index.md", content: "# Draft", baseOid: oid },
        { op: "write", path: "book/two.md", content: "# Two", baseOid: null },
        { op: "write", path: "public/data.csv", content: "a,b", baseOid: null },
      ],
    });

    const { browser } = await openPreview(instance, (await owner.c.post(`/api/books/${book.id}/preview-code`)).body.url);
    expect((await browser.get("/")).body).toContain("# Draft");
    expect((await browser.get("/two")).body).toContain("# Two");
    expect((await browser.get("/two.html")).body).toContain("# Two");
    expect((await browser.get("/data.csv")).body).toBe("a,b");
    expect((await browser.get("/nothing")).status).toBe(404);
    const live = bookClient(instance, "physics.books.test");
    expect((await live.get("/book/index.md")).body).toContain("# Physics");
  });

  it("shows a page with the editor's unsaved text until the next save", async () => {
    const { instance, owner, book } = await world();
    const render = (path: string, text: string) =>
      owner.c.post(`/api/books/${book.id}/files/render`, { path, text });
    const { browser } = await openPreview(instance, (await owner.c.post(`/api/books/${book.id}/preview-code`)).body.url);

    expect((await render("book/index.md", "# Typing")).body).toMatchObject({ ok: true, href: "/" });
    expect((await browser.get("/")).body).toContain("# Typing");
    // A new page that is not saved yet.
    expect((await render("book/new.md", "# New")).body).toMatchObject({ ok: true, href: "/new" });
    expect((await browser.get("/new")).body).toContain("# New");
    // Only one page has unsaved text: the one before is back to its saved text.
    expect((await browser.get("/")).body).toContain("# Physics");

    const listing = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    const oid = listing.files.find((f: { path: string }) => f.path === "book/index.md").oid;
    await owner.c.post(`/api/books/${book.id}/files/commit`, {
      changes: [{ op: "write", path: "book/index.md", content: "# Saved", baseOid: oid }],
    });
    expect((await browser.get("/")).body).toContain("# Saved");
    expect((await browser.get("/new")).status).toBe(404);

    expect((await render("hyperbook.json", "{}")).status).toBe(400);
    expect((await render("../x.md", "")).status).toBe(400);
    const stranger = await loggedIn(instance, { email: "s@example.org" });
    expect((await stranger.c.post(`/api/books/${book.id}/files/render`, { path: "book/index.md", text: "" })).status).toBe(404);
  });

  it("refuses hand-offs from elsewhere and teachers of other books", async () => {
    const { instance, owner, other, book } = await world();
    expect((await other.c.post(`/api/books/${book.id}/preview-code`)).status).toBe(404);

    const { url } = (await owner.c.post(`/api/books/${book.id}/preview-code`)).body;
    const code = new URLSearchParams(new URL(url).hash.slice(1)).get("c")!;
    const foreign = bookClient(instance, PREVIEW, { origin: "http://physics.books.test" });
    expect((await foreign.post("/_hyperbook/api/preview", { code })).status).toBe(403);

    // A code of one book does not open another book's preview.
    await owner.c.post("/api/books", { title: "Maths", slug: "maths" });
    const maths = bookClient(instance, "maths--preview.books.test");
    expect((await maths.post("/_hyperbook/api/preview", { code })).status).toBe(401);
  });

  it("ends the preview of a teacher who leaves the book", async () => {
    const { instance, owner, other, book } = await world();
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    const { browser } = await openPreview(instance, (await other.c.post(`/api/books/${book.id}/preview-code`)).body.url);
    expect((await browser.get("/")).status).toBe(200);
    await owner.c.delete(`/api/books/${book.id}/members/${other.user.id}`);
    expect((await browser.get("/")).status).toBe(403);
  });

  it("has no student API and is known to the TLS check", async () => {
    const { instance } = await world();
    const browser = bookClient(instance, PREVIEW);
    expect((await browser.get("/_hyperbook/api/session")).status).toBe(404);
    const check = async (domain: string) => (await instance.app.request(`/api/tls-check?domain=${domain}`)).status;
    expect(await check(PREVIEW)).toBe(200);
    expect(await check("nope--preview.books.test")).toBe(404);
  });
});
