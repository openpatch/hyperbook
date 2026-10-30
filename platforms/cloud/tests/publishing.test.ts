import { zipSync, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);

const bookZip = (index = "<h1>Hello</h1>") =>
  zipSync({
    "physics/hyperbook.json": text('{"name":"Physics"}'),
    "physics/index.html": text(index),
  });

async function world(env: Record<string, string> = {}) {
  const instance = setup(env);
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Owner" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  return { instance, owner, other, book };
}

describe("publishing", () => {
  it("uploads and builds a preview, which publishing then makes live", async () => {
    const { instance, owner, book } = await world();
    const res = await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: true, files: 2, build: { status: "queued", trigger: "upload" } });
    await instance.builds.idle();

    const builds = (await owner.c.get(`/api/books/${book.id}/builds`)).body;
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      status: "succeeded",
      published: false,
      preview: true,
      requestedBy: "o@example.org",
    });
    const detail = (await owner.c.get(`/api/builds/${builds[0].id}`)).body;
    expect(detail.log).toContain("Checking out");
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBeNull();

    await owner.c.post(`/api/books/${book.id}/publish`, {});
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBe(builds[0].id);
  });

  it("records the links an upload left out in the build's log", async () => {
    const { instance, owner, book } = await world();
    const zip = zipSync({
      "physics/hyperbook.json": text('{"name":"Physics"}'),
      "physics/index.html": text("<h1>Hello</h1>"),
      // Unix mode 0120777 (symlink) in the upper half of the attributes.
      "physics/link": [text("/etc/passwd"), { os: 3, attrs: (0o120777 << 16) >>> 0 }],
    });
    const res = await owner.c.upload(`/api/books/${book.id}/source`, zip);
    expect(res.body.skipped).toEqual(["link"]);
    await instance.builds.idle();
    // The whole list stays traceable in the log, also once the build has run.
    const detail = (await owner.c.get(`/api/builds/${res.body.build.id}`)).body;
    expect(detail.log).toContain("left out 1 link(s)");
    expect(detail.log).toContain("\n  link");
  });

  it("downloads the current source", async () => {
    const { owner, book } = await world();
    expect((await owner.c.get(`/api/books/${book.id}/source.zip`)).status).toBe(404);
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    const res = await owner.c.raw("GET", `/api/books/${book.id}/source.zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("physics.zip");
  });

  it("returns the source as a zip without the top folder", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    const res = await instance.app.request(`/api/books/${book.id}/source.zip`, {
      headers: { host: "admin.test", cookie: owner.c.cookie },
    });
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["hyperbook.json", "index.html"]);
  });

  it("rebuilds and notices unchanged uploads", async () => {
    const { instance, owner, book } = await world();
    expect((await owner.c.post(`/api/books/${book.id}/builds`)).status).toBe(409);
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect((await owner.c.upload(`/api/books/${book.id}/source`, bookZip())).body.changed).toBe(false);
    const rebuild = await owner.c.post(`/api/books/${book.id}/builds`);
    expect(rebuild.body).toMatchObject({ trigger: "rebuild" });
    await instance.builds.idle();
    const row = (await owner.c.get(`/api/books/${book.id}`)).body;
    expect(row.previewBuildId).toBe(rebuild.body.id);
    expect(row.publishedBuildId).toBeNull();
  });

  it("accepts uploads only with the admin origin attached", async () => {
    const { instance, owner, book } = await world();
    const form = new FormData();
    form.append("file", new File([bookZip() as BlobPart], "book.zip"));
    const res = await instance.app.request(`/api/books/${book.id}/source`, {
      method: "POST",
      headers: { host: "admin.test", cookie: owner.c.cookie },
      body: form,
    });
    expect(res.status).toBe(415);
  });

  it("refuses bad zips with a message", async () => {
    const { owner, book } = await world();
    const res = await owner.c.upload(
      `/api/books/${book.id}/source`,
      zipSync({ "index.md": text("# no config") }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hyperbook.json/);
  });

  it("refuses zips over the size limit", async () => {
    const { owner, book } = await world({ UPLOAD_MAX_MB: "1" });
    const big = zipSync({ "hyperbook.json": text("{}"), "x.bin": crypto.getRandomValues(new Uint8Array(65536)) }, { level: 0 });
    const huge = new Uint8Array(2 * 1024 * 1024);
    huge.set(big);
    const res = await owner.c.upload(`/api/books/${book.id}/source`, huge);
    expect(res.status).toBe(413);
  });

  it("keeps books of others out of reach", async () => {
    const { owner, other, book } = await world();
    const upload = await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect((await other.c.upload(`/api/books/${book.id}/source`, bookZip())).status).toBe(404);
    expect((await other.c.get(`/api/books/${book.id}/builds`)).status).toBe(404);
    expect((await other.c.get(`/api/builds/${upload.body.build.id}`)).status).toBe(404);
    expect((await other.c.post(`/api/books/${book.id}/unpublish`)).status).toBe(404);
  });

  it("unpublishes", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/unpublish`);
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBeNull();
  });

  it("publishes the current commit without building it again", async () => {
    const { instance, owner, book } = await world();
    expect((await owner.c.post(`/api/books/${book.id}/publish`)).status).toBe(409);
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/unpublish`);
    const res = await owner.c.post(`/api/books/${book.id}/publish`);
    expect(res.body).toMatchObject({ published: true });
    const builds = (await owner.c.get(`/api/books/${book.id}/builds`)).body;
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({ published: true, preview: true });
  });

  it("builds the current commit to publish it when its build is not kept", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await instance.builds.idle();
    const upload = (await owner.c.get(`/api/books/${book.id}/builds`)).body[0];
    const { rmSync } = await import("node:fs");
    const { buildDir } = await import("../src/server/hosting/storage");
    rmSync(buildDir(instance.config, book.id, upload.id), { recursive: true });
    const res = await owner.c.post(`/api/books/${book.id}/publish`);
    expect(res.body).toMatchObject({ published: false, build: { trigger: "publish", publish: true } });
    await instance.builds.idle();
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBe(res.body.build.id);
  });

  it("refuses uploads to externally hosted books", async () => {
    const { owner, book } = await world();
    await owner.c.patch(`/api/books/${book.id}`, { externalUrl: "https://example.org/book" });
    expect((await owner.c.upload(`/api/books/${book.id}/source`, bookZip())).status).toBe(409);
  });

  it("deletes a book's files with the book", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await instance.builds.idle();
    const { existsSync } = await import("node:fs");
    const { bookDir } = await import("../src/server/hosting/storage");
    expect(existsSync(bookDir(instance.config, book.id))).toBe(true);
    await owner.c.delete(`/api/books/${book.id}`);
    expect(existsSync(bookDir(instance.config, book.id))).toBe(false);
  });
});
