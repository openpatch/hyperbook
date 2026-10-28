import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createUser, loggedIn, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);

async function published() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const zip = zipSync({
    "hyperbook.json": text("{}"),
    "index.html": text("<h1>Home</h1>"),
    "page.html": text("<h1>Page</h1>"),
    "section/index.html": text("<h1>Section</h1>"),
    "404.html": text("<h1>Lost</h1>"),
    "media/sound.mp3": text("0123456789"),
    "_hyperbook/login.html": text("must not be served"),
  });
  await owner.c.upload(`/api/books/${book.id}/source`, zip);
  await instance.builds.idle();
  const get = (path: string, headers: Record<string, string> = {}, host = "physics.books.test") =>
    instance.app.request(path, { headers: { host, ...headers } });
  return { instance, owner, book, get };
}

describe("serving books", () => {
  it("serves pages with clean URLs", async () => {
    const { get } = await published();
    expect(await (await get("/")).text()).toBe("<h1>Home</h1>");
    expect(await (await get("/page")).text()).toBe("<h1>Page</h1>");
    expect(await (await get("/page.html")).text()).toBe("<h1>Page</h1>");
    expect(await (await get("/section")).text()).toBe("<h1>Section</h1>");
    expect(await (await get("/section/")).text()).toBe("<h1>Section</h1>");
    const res = await get("/page");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers missing pages with the book's 404 page", async () => {
    const { get } = await published();
    const res = await get("/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("<h1>Lost</h1>");
  });

  it("refuses paths that leave the build", async () => {
    const { get } = await published();
    for (const path of ["/section%2Findex.html", "/a%5C..%5Cb", "/%00"]) {
      expect((await get(path)).status, path).toBe(400);
    }
    // The URL parser resolves encoded dots itself, so this stays in the book.
    const dots = await get("/%2e%2e/%2e%2e/database.sqlite");
    expect(dots.status).toBe(404);
    expect(await dots.text()).toBe("<h1>Lost</h1>");
  });

  it("keeps /_hyperbook for the platform", async () => {
    const { get } = await published();
    expect((await get("/_hyperbook/login.html")).status).toBe(404);
  });

  it("supports conditional requests, ranges and HEAD", async () => {
    const { instance, get } = await published();
    const first = await get("/media/sound.mp3");
    expect(first.headers.get("content-type")).toBe("audio/mpeg");
    const etag = first.headers.get("etag")!;
    expect((await get("/media/sound.mp3", { "if-none-match": etag })).status).toBe(304);

    const part = await get("/media/sound.mp3", { range: "bytes=2-4" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(await part.text()).toBe("234");
    expect(await (await get("/media/sound.mp3", { range: "bytes=-3" })).text()).toBe("789");
    expect((await get("/media/sound.mp3", { range: "bytes=20-" })).status).toBe(416);

    const head = await instance.app.request("/page", { method: "HEAD", headers: { host: "physics.books.test" } });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("13");
    expect(await head.text()).toBe("");

    const post = await instance.app.request("/page", { method: "POST", headers: { host: "physics.books.test" } });
    expect(post.status).toBe(405);
  });

  it("redirects old addresses after a rename", async () => {
    const { owner, book, get } = await published();
    await owner.c.patch(`/api/books/${book.id}`, { slug: "physik" });
    const res = await get("/page?x=1");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("http://physik.books.test/page?x=1");
    expect(await (await get("/page", {}, "physik.books.test")).text()).toBe("<h1>Page</h1>");
  });

  it("does not serve unpublished, private or external books", async () => {
    const { instance, owner, book, get } = await published();
    await owner.c.post(`/api/books/${book.id}/unpublish`);
    expect((await get("/")).status).toBe(404);
    expect(await (await get("/")).text()).toContain("not published yet");

    await owner.c.post(`/api/books/${book.id}/builds`);
    await instance.builds.idle();
    expect((await get("/")).status).toBe(200);

    const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    await admin.c.patch(`/api/books/${book.id}`, { visibility: "private" });
    const login = await get("/page?x=1");
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe("/_hyperbook/login?next=%2Fpage%3Fx%3D1");

    await admin.c.patch(`/api/books/${book.id}`, { visibility: "public", externalUrl: "https://example.org/<b>" });
    const external = await get("/");
    expect(external.status).toBe(404);
    expect(await external.text()).toContain('href="https://example.org/&#60;b&#62;"');
  });
});

describe("tls-check", () => {
  it("allows the admin host and existing books only", async () => {
    const { owner, book, instance } = await published();
    const check = async (domain: string) =>
      (await instance.app.request(`/api/tls-check?domain=${domain}`, { headers: { host: "127.0.0.1" } })).status;
    expect(await check("admin.test")).toBe(200);
    expect(await check("physics.books.test")).toBe(200);
    expect(await check("PHYSICS.books.test")).toBe(200);
    expect(await check("chemistry.books.test")).toBe(404);
    expect(await check("books.test")).toBe(404);
    expect(await check("evil.example")).toBe(404);
    expect(await check("")).toBe(404);

    await owner.c.patch(`/api/books/${book.id}`, { slug: "physik" });
    expect(await check("physik.books.test")).toBe(200);
    expect(await check("physics.books.test")).toBe(200); // still redirects
  });
});

describe("admin on the bare books domain", () => {
  it("serves the admin UI on the domain and books below it", async () => {
    const instance = setup({ ADMIN_ORIGIN: "http://hyperbook.test", BOOKS_DOMAIN: "hyperbook.test" });
    await createUser(instance, { email: "a@example.org", role: "admin" });
    const admin = { host: "hyperbook.test", origin: "http://hyperbook.test", "content-type": "application/json" };
    const login = await instance.app.request("/api/auth/login", {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ email: "a@example.org", password: "correct horse battery" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const created = await instance.app.request("/api/books", {
      method: "POST",
      headers: { ...admin, cookie },
      body: JSON.stringify({ title: "Physik", slug: "physik" }),
    });
    expect((await created.json()).url).toBe("http://physik.hyperbook.test");

    const book = await instance.app.request("/", { headers: { host: "physik.hyperbook.test", cookie } });
    expect(await book.text()).toContain("not published yet");
    // The admin session is a host-only cookie: books below never get it.
    expect(cookie.startsWith("__Host-")).toBe(true);

    const check = async (domain: string) => (await instance.app.request(`/api/tls-check?domain=${domain}`)).status;
    expect(await check("hyperbook.test")).toBe(200);
    expect(await check("physik.hyperbook.test")).toBe(200);
  });
});
