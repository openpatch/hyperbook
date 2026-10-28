import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

async function world({ suffix = true } = {}) {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
  if (suffix) expect((await admin.c.put("/api/instance", { slugSuffix: true })).status).toBe(200);
  const teacher = await loggedIn(instance, { email: "t@example.org", displayName: "Tess" });
  const book = (await teacher.c.post("/api/books", { title: "Physik", slug: "physik" })).body;
  return { instance, admin, teacher, book };
}

const SUFFIXED = /^physik-[a-z2-9]{4}$/;

describe("suffix mode", () => {
  it("is off by default: teachers choose the whole address", async () => {
    const { book } = await world({ suffix: false });
    expect(book.slug).toBe("physik");
    expect(book.slugSuffix).toBeNull();
  });

  it("gives teachers' books a suffix that stays when they rename them", async () => {
    const { teacher, book } = await world();
    expect(book.slug).toMatch(SUFFIXED);
    expect(book.slug).toBe(`physik-${book.slugSuffix}`);

    const renamed = await teacher.c.patch(`/api/books/${book.id}`, { slug: "physik-7a" });
    expect(renamed.body.slug).toBe(`physik-7a-${book.slugSuffix}`);
    // The whole address, as the form shows it, works too.
    const again = await teacher.c.patch(`/api/books/${book.id}`, { slug: `mechanik-${book.slugSuffix}` });
    expect(again.body.slug).toBe(`mechanik-${book.slugSuffix}`);

    const long = await teacher.c.patch(`/api/books/${book.id}`, { slug: "a".repeat(60) });
    expect(long.status).toBe(400);
    expect(long.body.error).toMatch(/at most 58 characters/);
  });

  it("lets admins choose freely", async () => {
    const { admin } = await world();
    const book = (await admin.c.post("/api/books", { title: "Mathe", slug: "mathe" })).body;
    expect(book.slug).toBe("mathe");
  });

  it("gives books made before suffix mode a suffix when they are renamed", async () => {
    const { admin, teacher, book } = await world({ suffix: false });
    await admin.c.put("/api/instance", { slugSuffix: true });
    // Saving other settings sends the address unchanged: it stays as it is.
    expect((await teacher.c.patch(`/api/books/${book.id}`, { title: "P", slug: "physik" })).body.slug).toBe("physik");
    const renamed = (await teacher.c.patch(`/api/books/${book.id}`, { slug: "physik-neu" })).body;
    expect(renamed.slug).toBe(`physik-neu-${renamed.slugSuffix}`);
  });
});

describe("address requests", () => {
  it("asks for an address, which an admin grants", async () => {
    const { instance, admin, teacher, book } = await world();
    const asked = await teacher.c.post(`/api/books/${book.id}/slug-request`, {
      slug: "physik",
      description: "Physik für die Sekundarstufe I, alle Themen bis Klasse 10.",
    });
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ slug: "physik", status: "pending" });
    expect((await teacher.c.get(`/api/books/${book.id}/slug-request`)).body.status).toBe("pending");
    expect(instance.mailer.sent.at(-1)).toMatchObject({ to: "admin@example.org", subject: /physik: address requested/ });

    const list = (await admin.c.get("/api/slug-requests")).body;
    expect(list.pending).toHaveLength(1);
    expect(list.pending[0]).toMatchObject({
      slug: "physik",
      book: { id: book.id, slug: book.slug, url: `http://${book.slug}.books.test` },
      requestedBy: { email: "t@example.org", displayName: "Tess" },
      takenBy: null,
    });

    const id = list.pending[0].id;
    expect((await admin.c.post(`/api/slug-requests/${id}/approve`, { note: "Schönes Buch!" })).status).toBe(200);
    const granted = (await teacher.c.get(`/api/books/${book.id}`)).body;
    expect(granted).toMatchObject({ slug: "physik", slugGranted: true, slugSuffix: book.slugSuffix });
    expect((await teacher.c.get(`/api/books/${book.id}/slug-request`)).body).toMatchObject({
      status: "approved",
      note: "Schönes Buch!",
    });
    expect(instance.mailer.sent.at(-1)).toMatchObject({ to: "t@example.org", text: /Schönes Buch!/ });

    // The suffixed address redirects to the granted one.
    const old = await instance.app.request("/", { headers: { host: `${book.slug}.books.test` } });
    expect(old.headers.get("location")).toBe("http://physik.books.test/");
    expect((await admin.c.get("/api/slug-requests")).body.granted).toMatchObject([{ id: book.id, slug: "physik" }]);
  });

  it("keeps a granted address out of the teacher's hands", async () => {
    const { admin, teacher, book } = await world();
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "Physik" });
    const [request] = (await admin.c.get("/api/slug-requests")).body.pending;
    await admin.c.post(`/api/slug-requests/${request.id}/approve`, {});
    const rename = await teacher.c.patch(`/api/books/${book.id}`, { slug: "physik-neu" });
    expect(rename.status).toBe(403);
    const ask = await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "fysik", description: "x" });
    expect(ask.status).toBe(409);
  });

  it("declines with a note", async () => {
    const { instance, admin, teacher, book } = await world();
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "Erst zwei Seiten" });
    const [request] = (await admin.c.get("/api/slug-requests")).body.pending;
    await admin.c.post(`/api/slug-requests/${request.id}/decline`, { note: "Gern, wenn mehr Inhalt da ist." });
    expect((await teacher.c.get(`/api/books/${book.id}`)).body.slug).toBe(book.slug);
    expect((await teacher.c.get(`/api/books/${book.id}/slug-request`)).body).toMatchObject({
      status: "declined",
      note: "Gern, wenn mehr Inhalt da ist.",
    });
    expect(instance.mailer.sent.at(-1)).toMatchObject({ to: "t@example.org", text: /mehr Inhalt/ });
    expect((await admin.c.post(`/api/slug-requests/${request.id}/approve`, {})).status).toBe(409);
  });

  it("declines the other books that asked for the same address", async () => {
    const { instance, admin, teacher, book } = await world();
    const other = await loggedIn(instance, { email: "u@example.org" });
    const second = (await other.c.post("/api/books", { title: "Physik 2", slug: "physik" })).body;
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "A" });
    await other.c.post(`/api/books/${second.id}/slug-request`, { slug: "physik", description: "B" });
    const pending = (await admin.c.get("/api/slug-requests")).body.pending;
    expect(pending).toHaveLength(2);
    await admin.c.post(`/api/slug-requests/${pending[1].id}/approve`, {});
    expect((await teacher.c.get(`/api/books/${book.id}/slug-request`)).body).toMatchObject({
      status: "declined",
      note: "The address was given to another book.",
    });
    expect((await admin.c.get("/api/slug-requests")).body.pending).toHaveLength(0);
  });

  it("replaces an open request, and can be withdrawn", async () => {
    const { admin, teacher, book } = await world();
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "A" });
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "fysik", description: "B" });
    expect((await admin.c.get("/api/slug-requests")).body.pending.map((r: { slug: string }) => r.slug)).toEqual(["fysik"]);
    await teacher.c.delete(`/api/books/${book.id}/slug-request`);
    expect((await admin.c.get("/api/slug-requests")).body.pending).toHaveLength(0);
    expect((await teacher.c.get(`/api/books/${book.id}/slug-request`)).body).toBeNull();
  });

  it("refuses reserved, taken and invalid names, and requests outside suffix mode", async () => {
    const { admin, teacher, book } = await world();
    await admin.c.post("/api/books", { title: "Mathe", slug: "mathe" });
    const ask = (slug: string) => teacher.c.post(`/api/books/${book.id}/slug-request`, { slug, description: "x" });
    expect((await ask("admin")).status).toBe(409);
    expect((await ask("mathe")).status).toBe(409);
    expect((await ask("Not Valid")).status).toBe(400);
    expect((await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "" })).status).toBe(400);

    await admin.c.put("/api/instance", { slugSuffix: false });
    expect((await ask("physik")).status).toBe(400);
  });

  it("is for owners and admins only", async () => {
    const { instance, teacher, book } = await world();
    const editor = await loggedIn(instance, { email: "e@example.org" });
    await teacher.c.post(`/api/books/${book.id}/members`, { email: "e@example.org", role: "editor" });
    expect((await editor.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "x" })).status).toBe(403);
    expect((await teacher.c.get("/api/slug-requests")).status).toBe(403);
    expect((await teacher.c.post(`/api/books/${book.id}/slug/revoke`, {})).status).toBe(403);
  });

  it("takes a granted address back", async () => {
    const { instance, admin, teacher, book } = await world();
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "A" });
    const [request] = (await admin.c.get("/api/slug-requests")).body.pending;
    await admin.c.post(`/api/slug-requests/${request.id}/approve`, {});

    const revoked = await admin.c.post(`/api/books/${book.id}/slug/revoke`, { note: "Seit einem Jahr leer." });
    expect(revoked.body.slug).toBe(book.slug);
    expect((await teacher.c.get(`/api/books/${book.id}`)).body).toMatchObject({ slug: book.slug, slugGranted: false });
    expect(instance.mailer.sent.at(-1)).toMatchObject({ to: "t@example.org", text: /Seit einem Jahr leer/ });
    // The teacher may rename again, and the freed name redirects until it is given away.
    const old = await instance.app.request("/", { headers: { host: "physik.books.test" } });
    expect(old.headers.get("location")).toBe(`http://${book.slug}.books.test/`);
    expect((await admin.c.post(`/api/books/${book.id}/slug/revoke`, {})).status).toBe(409);
  });

  it("is written to the audit log", async () => {
    const { admin, teacher, book } = await world();
    await teacher.c.post(`/api/books/${book.id}/slug-request`, { slug: "physik", description: "A" });
    const [request] = (await admin.c.get("/api/slug-requests")).body.pending;
    await admin.c.post(`/api/slug-requests/${request.id}/approve`, {});
    await admin.c.post(`/api/books/${book.id}/slug/revoke`, {});
    const actions = (await admin.c.get("/api/audit")).body.entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["book.slug.request", "book.slug.approve", "book.slug.revoke"]));
  });
});
