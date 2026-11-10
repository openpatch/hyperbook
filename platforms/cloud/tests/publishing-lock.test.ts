import { zipSync } from "fflate";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, books } from "../src/server/db/schema";
import { loggedIn, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);

const bookZip = (index = "<h1>Hello</h1>") =>
  zipSync({
    "exam/hyperbook.json": text('{"name":"Exam"}'),
    "exam/index.html": text(index),
  });

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Owner" });
  const editor = await loggedIn(instance, { email: "e@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Exam", slug: "exam" })).body;
  await owner.c.post(`/api/books/${book.id}/members`, { email: "e@example.org", role: "editor" });
  await owner.c.upload(`/api/books/${book.id}/source`, bookZip());
  const get = async () => (await owner.c.get(`/api/books/${book.id}`)).body;
  const lock = (disabled: boolean, as = owner) =>
    as.c.post(`/api/books/${book.id}/publishing-lock`, { disabled });
  return { instance, owner, editor, book, get, lock };
}

describe("publishing lock", () => {
  it("is off for a new book", async () => {
    const { get } = await world();
    expect((await get()).publishingDisabled).toBe(false);
  });

  it("refuses to publish, to roll back and to ask for a publish while set", async () => {
    const { instance, owner, editor, book, get, lock } = await world();
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    expect((await get()).publishedBuildId).not.toBeNull();

    expect((await lock(true)).status).toBe(200);

    const publish = await owner.c.post(`/api/books/${book.id}/publish`, {});
    expect(publish.status).toBe(403);
    expect(publish.body.error).toBe("publishing.lock.refused");
    expect((await owner.c.post(`/api/books/${book.id}/rollback`, { tag: "v1" })).status).toBe(403);
    expect((await editor.c.post(`/api/books/${book.id}/publish-request`, {})).status).toBe(403);
    await instance.builds.idle();
    expect((await get()).publishedBuildId).toBeNull();
  });

  it("takes a live book offline and drops an open request when it is set", async () => {
    const { instance, owner, editor, book, get, lock } = await world();
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    await owner.c.upload(`/api/books/${book.id}/source`, bookZip("<h1>More</h1>"));
    await editor.c.post(`/api/books/${book.id}/publish-request`, { note: "please" });

    const locked = (await lock(true)).body;
    expect(locked).toMatchObject({ publishingDisabled: true, publishedBuildId: null, publishedAt: null });
    expect((await owner.c.get(`/api/books/${book.id}/head`)).body.request).toBeNull();
  });

  it("keeps a publish build that is still running from going live", async () => {
    const { instance, owner, book, get, lock } = await world();
    const publish = await owner.c.post(`/api/books/${book.id}/publish`, {});
    expect(publish.body).toMatchObject({ published: false });
    // Set while the build waits or runs.
    await lock(true);
    await instance.builds.idle();
    expect((await get()).publishedBuildId).toBeNull();
  });

  it("is enforced where a build goes live, whatever queued it", async () => {
    const { instance, owner, book, get } = await world();
    const publish = await owner.c.post(`/api/books/${book.id}/publish`, {});
    // The flag alone, as if it were set between the route's check and the
    // end of the build: the build still says it publishes.
    instance.db.update(books).set({ publishingDisabled: true }).where(eq(books.id, book.id)).run();
    await instance.builds.idle();
    expect((await get()).publishedBuildId).toBeNull();
    const detail = (await owner.c.get(`/api/builds/${publish.body.build.id}`)).body;
    expect(detail.status).toBe("succeeded");
    expect(detail.log).toContain("Publishing is disabled for this book");
    // Nothing went live, so nothing was recorded as a publish: no audit
    // entry, no version tag, and the log does not say "Published".
    expect(instance.db.select().from(auditLog).where(eq(auditLog.action, "book.publish")).all()).toHaveLength(0);
    expect((await owner.c.get(`/api/books/${book.id}/versions`)).body).toEqual([]);
    expect(detail.log).not.toContain("Published (");
  });

  it("does not publish instantly from a kept build either", async () => {
    const { instance, owner, book, get, lock } = await world();
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    await lock(true);
    expect((await owner.c.post(`/api/books/${book.id}/publish`, {})).status).toBe(403);
    expect((await get()).publishedBuildId).toBeNull();
  });

  it("allows publishing again once it is lifted", async () => {
    const { instance, owner, book, get, lock } = await world();
    await lock(true);
    expect((await lock(false)).body.publishingDisabled).toBe(false);
    // Lifting it publishes nothing by itself.
    expect((await get()).publishedBuildId).toBeNull();
    expect((await owner.c.post(`/api/books/${book.id}/publish`, {})).status).toBe(200);
    await instance.builds.idle();
    expect((await get()).publishedBuildId).not.toBeNull();
  });

  it("can only be changed by owners and admins", async () => {
    const { instance, editor, book, get, lock } = await world();
    expect((await lock(true, editor)).status).toBe(403);
    expect((await get()).publishingDisabled).toBe(false);
    const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    expect((await lock(true, admin)).status).toBe(200);
    expect((await get()).publishingDisabled).toBe(true);
    // Editors still see the book and that it is locked.
    expect((await editor.c.get(`/api/books/${book.id}`)).body.publishingDisabled).toBe(true);
  });

  it("is written to the audit log", async () => {
    const { instance, owner, book, lock } = await world();
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    await lock(true);
    await lock(false);
    const actions = instance.db
      .select()
      .from(auditLog)
      .all()
      .filter((entry) => entry.action.startsWith("book.publishing"))
      .map((entry) => [entry.action, entry.targetId]);
    expect(actions).toEqual([
      ["book.publishingLock", book.id],
      ["book.publishingUnlock", book.id],
    ]);
  });

  it("is not offered for a book hosted elsewhere", async () => {
    const { owner, book, lock } = await world();
    await owner.c.patch(`/api/books/${book.id}`, { externalUrl: "https://example.org/exam" });
    expect((await lock(true)).status).toBe(409);
  });

  it("leaves previews, builds and downloads to the members", async () => {
    const { owner, editor, book, lock } = await world();
    await lock(true);
    expect((await editor.c.raw("GET", `/api/books/${book.id}/source.zip`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}/builds`)).status).toBe(200);
    expect((await editor.c.post(`/api/books/${book.id}/preview-code`)).status).toBe(200);
  });
});
