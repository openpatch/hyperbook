import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ADMIN_HOST, loggedIn, setup } from "./helpers";

async function world(env: Record<string, string> = {}) {
  const instance = setup(env);
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Owner" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const files = (path = "") => `/api/books/${book.id}/files${path}`;
  return { instance, owner, other, book, files };
}

const oidOf = (listing: { files: { path: string; oid: string }[] }, path: string) =>
  listing.files.find((f) => f.path === path)!.oid;

describe("files", () => {
  it("starts a book from a template, once", async () => {
    const { instance, owner, files } = await world();
    expect((await owner.c.get(files())).body).toEqual({ commit: null, files: [] });
    const res = await owner.c.post(files("/init"), { template: "default" });
    expect(res.status).toBe(200);
    expect(res.body.files.map((f: { path: string }) => f.path)).toContain("book/index.md");
    expect((await owner.c.post(files("/init"), { template: "empty" })).status).toBe(409);

    await instance.builds.idle();
    // Saving builds nothing: the preview renders pages, publishing builds.
    expect((await owner.c.get(files().replace("/files", "/builds"))).body).toEqual([]);
  });

  it("reads files as bytes that never render on the admin origin", async () => {
    const { owner, files } = await world();
    const listing = (await owner.c.post(files("/init"), { template: "empty" })).body;
    const res = await owner.c.raw("GET", files("/raw?path=book/index.md"));
    expect(res.status).toBe(200);
    expect(res.body).toContain("# Physics");
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-oid")).toBe(oidOf(listing, "book/index.md"));
    expect((await owner.c.get(files("/raw?path=nope.md"))).status).toBe(404);
    expect((await owner.c.get(files("/raw?path=../etc/passwd"))).status).toBe(400);
  });

  it("saves, uploads, renames and deletes files", async () => {
    const { owner, files } = await world();
    let listing = (await owner.c.post(files("/init"), { template: "empty" })).body;
    const res = await owner.c.post(files("/commit"), {
      changes: [
        { op: "write", path: "book/index.md", content: "# New", baseOid: oidOf(listing, "book/index.md") },
        { op: "write", path: "book/logo.png", content: Buffer.from([137, 80, 78, 71]).toString("base64"), encoding: "base64", baseOid: null },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: true });
    listing = res.body;
    const png = await owner.c.raw("GET", files("/raw?path=book/logo.png"));
    expect(png.headers.get("content-type")).toBe("application/octet-stream");

    listing = (
      await owner.c.post(files("/commit"), {
        changes: [{ op: "move", from: "book/logo.png", to: "book/images/logo.png", baseOid: oidOf(listing, "book/logo.png") }],
      })
    ).body;
    listing = (
      await owner.c.post(files("/commit"), {
        changes: [{ op: "delete", path: "book/images/logo.png", baseOid: oidOf(listing, "book/images/logo.png") }],
      })
    ).body;
    expect(listing.files.map((f: { path: string }) => f.path).sort()).toEqual([".gitignore", "book/index.md", "hyperbook.json"]);
  });

  it("tells which files someone else changed in the meantime", async () => {
    const { owner, files } = await world();
    const listing = (await owner.c.post(files("/init"), { template: "empty" })).body;
    const base = oidOf(listing, "book/index.md");
    await owner.c.post(files("/commit"), { changes: [{ op: "write", path: "book/index.md", content: "A", baseOid: base }] });
    const res = await owner.c.post(files("/commit"), {
      changes: [{ op: "write", path: "book/index.md", content: "B", baseOid: base }],
    });
    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual(["book/index.md"]);
  });

  it("refuses bad paths, a broken hyperbook.json and books over the limit", async () => {
    const { owner, files } = await world({ BOOK_MAX_MB: "1" });
    const listing = (await owner.c.post(files("/init"), { template: "empty" })).body;
    for (const path of ["../x.md", "/x.md", ".git/config", "a/.hyperbook/x", "a\\b.md", "a//b.md"]) {
      const res = await owner.c.post(files("/commit"), { changes: [{ op: "write", path, content: "x", baseOid: null }] });
      expect(res.status, path).toBe(400);
    }
    const broken = await owner.c.post(files("/commit"), {
      changes: [{ op: "write", path: "hyperbook.json", content: "{ name:", baseOid: oidOf(listing, "hyperbook.json") }],
    });
    expect(broken.status).toBe(400);
    expect(broken.body.error).toContain("hyperbook.json");
    const big = await owner.c.post(files("/commit"), {
      changes: [{ op: "write", path: "big.bin", content: Buffer.alloc(1.5 * 1024 * 1024).toString("base64"), encoding: "base64", baseOid: null }],
    });
    expect(big.status).toBe(413);
  });

  it("keeps books of others and external books out of reach", async () => {
    const { owner, other, files, book } = await world();
    await owner.c.post(files("/init"), { template: "empty" });
    expect((await other.c.get(files())).status).toBe(404);
    expect((await other.c.get(files("/raw?path=hyperbook.json"))).status).toBe(404);
    expect((await other.c.post(files("/commit"), { changes: [{ op: "write", path: "a.md", content: "", baseOid: null }] })).status).toBe(404);
    await owner.c.patch(`/api/books/${book.id}`, { externalUrl: "https://example.org/book" });
    expect((await owner.c.post(files("/commit"), { changes: [{ op: "write", path: "a.md", content: "", baseOid: null }] })).status).toBe(409);
  });

  it("downloads a build as a ZIP archive", async () => {
    const { instance, owner, files, book } = await world();
    await owner.c.post(files("/init"), { template: "empty" });
    const buildId = (await owner.c.post(`/api/books/${book.id}/publish`)).body.build.id;
    await instance.builds.idle();
    const res = await instance.app.request(`/api/books/${book.id}/builds/${buildId}/site.zip`, {
      headers: { host: ADMIN_HOST, cookie: owner.c.cookie },
    });
    expect(res.status).toBe(200);
    const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
    // The test runner "builds" by copying the source.
    expect(new TextDecoder().decode(zip["book/index.md"])).toContain("# Physics");
    expect((await owner.c.get(`/api/books/${book.id}/builds/999/site.zip`)).status).toBe(404);
  });
});
