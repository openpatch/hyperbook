import { zipSync, unzipSync } from "fflate";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog } from "../src/server/db/schema";
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
  it("uploads without building; publishing builds the latest save and makes it live", async () => {
    const { instance, owner, book } = await world();
    const res = await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: true, files: 2, skipped: [] });
    expect(res.body.build).toBeUndefined();
    expect((await owner.c.get(`/api/books/${book.id}/builds`)).body).toHaveLength(0);

    const publish = await owner.c.post(`/api/books/${book.id}/publish`, {});
    expect(publish.body).toMatchObject({ published: false, build: { trigger: "publish", publish: true } });
    expect(publish.body.build.preview).toBeUndefined();
    await instance.builds.idle();
    const detail = (await owner.c.get(`/api/builds/${publish.body.build.id}`)).body;
    expect(detail.log).toContain("Checking out");
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBe(publish.body.build.id);
  });

  it("tells which saves the live site does not have yet", async () => {
    const { instance, owner, book } = await world();
    const head = async () => (await owner.c.get(`/api/books/${book.id}/head`)).body;
    expect(await head()).toMatchObject({ commit: null, unpublished: 0, changes: [], request: null });
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    const first = await head();
    expect(first).toMatchObject({ commit: expect.any(String), unpublished: 1 });
    expect(first.savedAt).toEqual(expect.any(Number));
    expect(first.changes).toEqual([expect.objectContaining({ sha: first.commit, message: "Upload book.zip" })]);

    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    expect(await head()).toMatchObject({ commit: first.commit, unpublished: 0, changes: [] });

    await owner.c.upload(`/api/books/${book.id}/source`, bookZip("<h1>Hi</h1>"));
    const second = await head();
    expect(second.commit).not.toBe(first.commit);
    expect(second).toMatchObject({ unpublished: 1, changes: [expect.objectContaining({ sha: second.commit })] });
  });

  it("lists the links an upload left out", async () => {
    const { instance, owner, book } = await world();
    const zip = zipSync({
      "physics/hyperbook.json": text('{"name":"Physics"}'),
      "physics/index.html": text("<h1>Hello</h1>"),
      // Unix mode 0120777 (symlink) in the upper half of the attributes.
      "physics/link": [text("/etc/passwd"), { os: 3, attrs: (0o120777 << 16) >>> 0 }],
    });
    const res = await owner.c.upload(`/api/books/${book.id}/source`, zip);
    expect(res.body.skipped).toEqual(["link"]);
    // Traceable later, too.
    const entry = instance.db.select().from(auditLog).where(eq(auditLog.action, "book.upload")).get()!;
    expect(entry.data).toMatchObject({ skipped: ["link"] });
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

  it("notices unchanged uploads and has no rebuild anymore", async () => {
    const { owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect((await owner.c.upload(`/api/books/${book.id}/source`, bookZip())).body.changed).toBe(false);
    expect((await owner.c.post(`/api/books/${book.id}/builds`)).status).toBe(404);
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
    const { instance, owner, other, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    const publish = await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    expect((await other.c.upload(`/api/books/${book.id}/source`, bookZip())).status).toBe(404);
    expect((await other.c.get(`/api/books/${book.id}/builds`)).status).toBe(404);
    expect((await other.c.get(`/api/builds/${publish.body.build.id}`)).status).toBe(404);
    expect((await other.c.get(`/api/books/${book.id}/head`)).status).toBe(404);
    expect((await other.c.post(`/api/books/${book.id}/check`)).status).toBe(404);
    expect((await other.c.post(`/api/books/${book.id}/publish-request`, {})).status).toBe(404);
    expect((await other.c.post(`/api/books/${book.id}/unpublish`)).status).toBe(404);
  });

  it("lets only owners publish, roll back and unpublish", async () => {
    const { instance, owner, other, book } = await world();
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    expect((await other.c.post(`/api/books/${book.id}/publish`, {})).status).toBe(403);
    expect((await owner.c.post(`/api/books/${book.id}/publish`, {})).status).toBe(200);
    await instance.builds.idle();
    expect((await other.c.post(`/api/books/${book.id}/rollback`, { tag: "v1" })).status).toBe(403);
    expect((await other.c.post(`/api/books/${book.id}/unpublish`)).status).toBe(403);
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).not.toBeNull();
  });

  it("unpublishes", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/unpublish`);
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBeNull();
  });

  it("publishes the current commit without building it again", async () => {
    const { instance, owner, book } = await world();
    expect((await owner.c.post(`/api/books/${book.id}/publish`)).status).toBe(409);
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await owner.c.post(`/api/books/${book.id}/publish`);
    await instance.builds.idle();
    await owner.c.post(`/api/books/${book.id}/unpublish`);
    const res = await owner.c.post(`/api/books/${book.id}/publish`);
    expect(res.body).toMatchObject({ published: true });
    const builds = (await owner.c.get(`/api/books/${book.id}/builds`)).body;
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({ published: true });
  });

  it("builds the current commit to publish it when its build is not kept", async () => {
    const { instance, owner, book } = await world();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    const first = (await owner.c.post(`/api/books/${book.id}/publish`)).body.build;
    await instance.builds.idle();
    const { rmSync } = await import("node:fs");
    const { buildDir } = await import("../src/server/hosting/storage");
    rmSync(buildDir(instance.config, book.id, first.id), { recursive: true });
    const res = await owner.c.post(`/api/books/${book.id}/publish`);
    expect(res.body).toMatchObject({ published: false, build: { trigger: "publish", publish: true } });
    await instance.builds.idle();
    expect((await owner.c.get(`/api/books/${book.id}`)).body.publishedBuildId).toBe(res.body.build.id);
  });

  it("lets an editor ask the owners to publish, until an owner publishes", async () => {
    const { instance, owner, other, book } = await world();
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    instance.mailer.sent.length = 0;

    const asked = await other.c.post(`/api/books/${book.id}/publish-request`, { note: "Chapter 2 is done" });
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ by: "x@example.org", note: "Chapter 2 is done" });
    const head = (await owner.c.get(`/api/books/${book.id}/head`)).body;
    expect(head.request).toMatchObject({ by: "x@example.org", note: "Chapter 2 is done", at: expect.any(Number) });
    // The owner gets an email, the one asking does not.
    expect(instance.mailer.sent.map((m) => m.to)).toEqual(["o@example.org"]);
    expect(instance.mailer.sent[0]!.text).toContain("Chapter 2 is done");
    expect(instance.mailer.sent[0]!.text).toContain(`/books/${book.id}`);

    await owner.c.post(`/api/books/${book.id}/publish`, {});
    expect((await owner.c.get(`/api/books/${book.id}/head`)).body.request).toBeNull();
  });

  it("lets the owners or whoever asked dismiss a request to publish", async () => {
    const { owner, other, book } = await world();
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
    await owner.c.post(`/api/books/${book.id}/publish-request`, {});
    expect((await other.c.delete(`/api/books/${book.id}/publish-request`)).status).toBe(403);
    await other.c.post(`/api/books/${book.id}/publish-request`, {});
    expect((await other.c.delete(`/api/books/${book.id}/publish-request`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}/head`)).body.request).toBeNull();
    await other.c.post(`/api/books/${book.id}/publish-request`, {});
    expect((await owner.c.delete(`/api/books/${book.id}/publish-request`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}/head`)).body.request).toBeNull();
  });

  it("checks all pages of the latest save, also right after an upload", async () => {
    const { instance, owner, book } = await world();
    expect((await owner.c.post(`/api/books/${book.id}/check`)).status).toBe(409);
    expect((await owner.c.get(`/api/books/${book.id}/check`)).body).toBeNull();
    const zip = zipSync({
      "physics/hyperbook.json": text('{"name":"Physics"}'),
      "physics/book/index.md": text("# Hello"),
      "physics/book/waves/sound.md": text("# Sound"),
      "physics/glossary/wave.md": text("# Wave"),
    });
    const upload = await owner.c.upload(`/api/books/${book.id}/source`, zip);
    const state = await instance.checks.settled(book.id);
    expect(state).toMatchObject({ status: "done", total: 3, done: 3, problems: [], commit: upload.body.commit });

    const again = await owner.c.post(`/api/books/${book.id}/check`);
    expect(again.body).toMatchObject({ status: "running" });
    await instance.checks.settled(book.id);
    expect((await owner.c.get(`/api/books/${book.id}/check`)).body).toMatchObject({ status: "done", total: 3 });
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
