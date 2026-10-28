import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

const MB = 1024 * 1024;
const blob = (bytes: number) => Buffer.alloc(bytes, 1).toString("base64");

async function world() {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
  const teacher = await loggedIn(instance, { email: "t@example.org" });
  await admin.c.put(`/api/users/${teacher.user.id}/entitlements`, { max_storage_mb: 1 });
  const book = (await teacher.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  await teacher.c.post(`/api/books/${book.id}/files/init`, { template: "empty" });
  const commit = (changes: unknown[]) => teacher.c.post(`/api/books/${book.id}/files/commit`, { changes });
  return { instance, admin, teacher, book, commit };
}

describe("storage quota", () => {
  it("counts the source of owned books and refuses growing past the limit", async () => {
    const { teacher, commit } = await world();
    const before = (await teacher.c.get("/api/me")).body.storage;
    expect(before.limitBytes).toBe(MB);
    expect(before.usedBytes).toBeGreaterThan(0);

    const ok = await commit([{ op: "write", path: "a.bin", content: blob(0.5 * MB), encoding: "base64", baseOid: null }]);
    expect(ok.status).toBe(200);
    expect((await teacher.c.get("/api/me")).body.storage.usedBytes).toBeGreaterThan(0.5 * MB);

    const tooMuch = await commit([{ op: "write", path: "b.bin", content: blob(0.6 * MB), encoding: "base64", baseOid: null }]);
    expect(tooMuch.status).toBe(413);
    expect(tooMuch.body.error).toContain("your storage limit");

    // Shrinking always works.
    const oid = ok.body.files.find((f: { path: string }) => f.path === "a.bin").oid;
    expect((await commit([{ op: "delete", path: "a.bin", baseOid: oid }])).status).toBe(200);
  });

  it("counts all books of an owner, and every owner of a shared book", async () => {
    const { instance, admin, teacher, book, commit } = await world();
    const other = await loggedIn(instance, { email: "o@example.org" });
    await admin.c.put(`/api/users/${other.user.id}/entitlements`, { max_storage_mb: 1 });
    const second = (await other.c.post("/api/books", { title: "Maths", slug: "maths" })).body;
    await other.c.post(`/api/books/${second.id}/files/commit`, {
      changes: [{ op: "write", path: "big.bin", content: blob(0.8 * MB), encoding: "base64", baseOid: null }],
    });
    await teacher.c.post(`/api/books/${book.id}/members`, { email: "o@example.org", role: "owner" });

    // Fine for the teacher, but too much for the co-owner.
    const res = await commit([{ op: "write", path: "c.bin", content: blob(0.4 * MB), encoding: "base64", baseOid: null }]);
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("o@example.org");
  });

  it("checks zip uploads, and admins are not limited", async () => {
    const { admin, teacher, book } = await world();
    const zip = zipSync({ "hyperbook.json": new TextEncoder().encode("{}"), "big.bin": new Uint8Array(1.2 * MB) });
    expect((await teacher.c.upload(`/api/books/${book.id}/source`, zip)).status).toBe(413);
    const own = (await admin.c.post("/api/books", { title: "Admin", slug: "admin-book" })).body;
    expect((await admin.c.upload(`/api/books/${own.id}/source`, zip)).status).toBe(200);
    expect((await admin.c.get("/api/me")).body.storage.limitBytes).toBeNull();
  });
});
