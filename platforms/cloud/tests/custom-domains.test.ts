import { zipSync } from "fflate";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { books } from "../src/server/db/schema";
import { domainNameProblem } from "../src/server/domain/custom-domains";
import { bookClient } from "./book-client";
import { type Instance, loggedIn, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);
const DOMAIN = "buch.schule.test";

async function world() {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
  const owner = await loggedIn(instance, { email: "o@example.org" });
  await admin.c.put(`/api/users/${owner.user.id}/entitlements`, { custom_domain: true });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  await owner.c.upload(
    `/api/books/${book.id}/source`,
    zipSync({ "hyperbook.json": text("{}"), "index.html": text("<h1>Home</h1>") }),
  );
  await instance.builds.idle();
  await owner.c.post(`/api/books/${book.id}/publish`, {});
  await instance.builds.idle();
  return { instance, admin, owner, book };
}

/** The DNS record a teacher creates for `domain`, as the API asked for it. */
function configureDns(instance: Instance, domain: { name: string; target: string }) {
  instance.dns.records.set(domain.name, { cname: [domain.target + "."] });
}

async function active() {
  const w = await world();
  const claimed = await w.owner.c.put(`/api/books/${w.book.id}/domain`, { domain: DOMAIN });
  configureDns(w.instance, claimed.body.domain);
  const checked = await w.owner.c.post(`/api/books/${w.book.id}/domain/check`);
  expect(checked.body.domain.active).toBe(true);
  return w;
}

describe("domain names", () => {
  const { config } = setup();
  it("accepts host names outside the platform's own domains", () => {
    expect(domainNameProblem(config, "buch.schule.de")).toBeNull();
    expect(domainNameProblem(config, "schule.de")).toBeNull();
  });

  it("refuses malformed names and the platform's own domains", () => {
    for (const name of ["localhost", "schule", "1.2.3.4", "-a.de", "a..de", "a_b.de", "x".repeat(64) + ".de"]) {
      expect(domainNameProblem(config, name), name).toMatch(/Enter a domain/);
    }
    for (const name of ["admin.test", "x.admin.test", "books.test", "physics.books.test"]) {
      expect(domainNameProblem(config, name), name).toMatch(/belongs to the platform/);
    }
  });
});

describe("custom domains", () => {
  it("claims a domain and says which record to create", async () => {
    const { owner, book } = await world();
    const res = await owner.c.put(`/api/books/${book.id}/domain`, { domain: "Buch.Schule.test." });
    expect(res.status).toBe(200);
    expect(res.body.domain).toMatchObject({
      name: DOMAIN,
      active: false,
      target: "physics.books.test",
      problem: `There is no CNAME record from ${DOMAIN} to physics.books.test yet.`,
    });
    expect(res.body.url).toBe("http://physics.books.test");
  });

  it("needs the entitlement, ownership and a hosted book", async () => {
    const { instance, admin, owner, book } = await world();
    const editor = await loggedIn(instance, { email: "e@example.org" });
    await admin.c.put(`/api/users/${editor.user.id}/entitlements`, { custom_domain: true });
    await owner.c.post(`/api/books/${book.id}/members`, { email: "e@example.org", role: "editor" });
    expect((await editor.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN })).status).toBe(403);

    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {});
    const refused = await owner.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatch(/custom domains/);

    const external = (await admin.c.post("/api/books", { title: "Ext", slug: "ext" })).body;
    await admin.c.patch(`/api/books/${external.id}`, { externalUrl: "https://example.github.io/ext/" });
    expect((await admin.c.put(`/api/books/${external.id}/domain`, { domain: DOMAIN })).status).toBe(400);
    expect((await admin.c.put(`/api/books/${book.id}/domain`, { domain: "x.books.test" })).status).toBe(400);
  });

  it("activates only with a CNAME to this book", async () => {
    const { instance, owner, book } = await world();
    await owner.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN });
    const check = async () => (await owner.c.post(`/api/books/${book.id}/domain/check`)).body.domain;

    // Another book's address, or the server's: says nothing about this book.
    instance.dns.records.set(DOMAIN, { cname: ["chemistry.books.test."] });
    expect((await check()).problem).toMatch(/no CNAME record/);
    instance.dns.records.set(DOMAIN, { cname: ["books.test."] });
    expect((await check()).active).toBe(false);

    instance.dns.records.set(DOMAIN, { cname: ["Physics.Books.test."] });
    const ok = await check();
    expect(ok).toMatchObject({ active: true, problem: null });
    expect(ok.checkedAt).toBeGreaterThan(0);
    expect((await owner.c.get(`/api/books/${book.id}`)).body.url).toBe(`http://${DOMAIN}`);
  });

  it("lets two books claim a domain, but only one use it", async () => {
    const { instance, admin, owner, book } = await active();
    const other = (await admin.c.post("/api/books", { title: "Other", slug: "other" })).body;
    await admin.c.put(`/api/books/${other.id}/domain`, { domain: DOMAIN });
    const check = () => admin.c.post(`/api/books/${other.id}/domain/check`);
    expect((await check()).body.domain).toMatchObject({ active: false, problem: expect.stringMatching(/no CNAME/) });

    // The DNS now names the other book, but the first still holds the domain.
    instance.dns.records.set(DOMAIN, { cname: ["other.books.test"] });
    expect((await check()).body.domain).toMatchObject({
      active: false,
      problem: "Another book uses this domain already.",
    });

    // Once the first book lets go, the second can take it.
    await owner.c.delete(`/api/books/${book.id}/domain`);
    expect((await admin.c.post(`/api/books/${other.id}/domain/check`)).body.domain.active).toBe(true);
  });

  it("accepts a CNAME to the book's old address after a rename", async () => {
    const { instance, owner, book } = await world();
    await owner.c.patch(`/api/books/${book.id}`, { slug: "physik" });
    const domain = (await owner.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN })).body.domain;
    expect(domain.target).toBe("physik.books.test");
    instance.dns.records.set(DOMAIN, { cname: ["physics.books.test"] });
    expect((await owner.c.post(`/api/books/${book.id}/domain/check`)).body.domain.active).toBe(true);
  });

  it("starts over when the domain changes, and can be removed", async () => {
    const { owner, book } = await active();
    const changed = await owner.c.put(`/api/books/${book.id}/domain`, { domain: "physik.schule.test" });
    expect(changed.body.domain).toMatchObject({ name: "physik.schule.test", active: false });
    const removed = await owner.c.delete(`/api/books/${book.id}/domain`);
    expect(removed.body.domain).toBeNull();
    expect(removed.body.url).toBe("http://physics.books.test");
  });

  it("serves the book on its active domain and redirects there", async () => {
    const { instance } = await active();
    const get = (host: string, path = "/") => instance.app.request(path, { headers: { host } });

    const home = await get(DOMAIN);
    expect(home.status).toBe(200);
    expect(await home.text()).toBe("<h1>Home</h1>");
    expect((await get(`${DOMAIN}:443`)).status).toBe(200);

    const moved = await get("physics.books.test", "/page?x=1");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe(`http://${DOMAIN}/page?x=1`);
    const login = await get("physics.books.test", "/_hyperbook/login?next=%2F");
    expect(login.headers.get("location")).toBe(`http://${DOMAIN}/_hyperbook/login?next=%2F`);
    expect((await get("unclaimed.schule.test")).status).toBe(404);
  });

  it("is not served before it is active", async () => {
    const { owner, book, instance } = await world();
    await owner.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN });
    expect((await instance.app.request("/", { headers: { host: DOMAIN } })).status).toBe(404);
    expect((await instance.app.request("/", { headers: { host: "physics.books.test" } })).status).toBe(200);
  });

  it("logs students in on the custom domain, and prints links to it", async () => {
    const { instance, owner, book } = await active();
    const group = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).body;
    await owner.c.post(`/api/groups/${group.id}/students`, { username: "ada", password: "secret-pass" });

    const b = bookClient(instance, DOMAIN);
    expect((await b.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(200);
    expect((await b.get("/_hyperbook/api/session")).body).toMatchObject({ user: { username: "ada" } });

    // The API stays reachable on the old address, from either origin.
    const old = bookClient(instance, "physics.books.test");
    expect((await old.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(200);
    const sibling = bookClient(instance, DOMAIN, { origin: "http://chemistry.books.test" });
    expect((await sibling.post("/_hyperbook/api/login", { username: "ada", password: "secret-pass" })).status).toBe(403);

    const credentials = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body;
    expect(credentials.loginAddress).toBe(`http://${DOMAIN}`);
    expect(credentials.students[0].loginUrl).toMatch(new RegExp(`^http://${DOMAIN}/_hyperbook/login#k=`));
  });

  it("checks HTTPS on an active domain, statelessly", async () => {
    const { instance, owner, book } = await world();
    const httpsCheck = () => owner.c.post(`/api/books/${book.id}/domain/https-check`);
    const healthUrl = `https://${DOMAIN}/api/health`;

    // Not active yet: refused.
    await owner.c.put(`/api/books/${book.id}/domain`, { domain: DOMAIN });
    expect((await httpsCheck()).status).toBe(409);
    configureDns(instance, (await owner.c.get(`/api/books/${book.id}`)).body.domain);
    await owner.c.post(`/api/books/${book.id}/domain/check`);

    // The fetch went through the proxy and got the certificate.
    instance.fetchUrl.responses.set(healthUrl, 200);
    expect((await httpsCheck()).body).toEqual({ problem: null });

    // Nothing was stored: a second check sees the fresh answer, not a status.
    instance.fetchUrl.responses.set(healthUrl, 503);
    expect((await httpsCheck()).body.problem).toMatch(/answered 503/);

    // DNS gone, or the certificate failed: the teacher is told why.
    instance.fetchUrl.responses.delete(healthUrl);
    expect((await httpsCheck()).body.problem).toMatch(/no longer points/);
    instance.fetchUrl.responses.set(
      healthUrl,
      new TypeError("fetch failed", { cause: { code: "ERR_TLS_CERT_ALTNAME_INVALID" } }),
    );
    expect((await httpsCheck()).body.problem).toMatch(/certificate/);
    const stored = instance.db.select({ problem: books.domainProblem }).from(books).where(eq(books.id, book.id)).get();
    expect(stored?.problem).toBeNull();
  });

  it("gets certificates for active domains only", async () => {
    const { instance, owner, book } = await active();
    const check = async (domain: string) =>
      (await instance.app.request(`/api/tls-check?domain=${domain}`, { headers: { host: "127.0.0.1" } })).status;
    expect(await check(DOMAIN)).toBe(200);
    expect(await check("other.schule.test")).toBe(404);
    await owner.c.put(`/api/books/${book.id}/domain`, { domain: "physik.schule.test" });
    expect(await check(DOMAIN)).toBe(404);
    expect(await check("physik.schule.test")).toBe(404);
  });

  it("is written to the audit log", async () => {
    const { admin, owner, book } = await active();
    await owner.c.delete(`/api/books/${book.id}/domain`);
    const actions = (await admin.c.get("/api/audit")).body.entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["book.domain.set", "book.domain.activate", "book.domain.remove"]));
  });
});
