import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "../src/server/auth/password";
import { open, seal } from "../src/server/crypto/sealed";
import { sha256 } from "../src/server/crypto/tokens";
import { auditLog, students } from "../src/server/db/schema";
import { nextUsernames } from "../src/server/domain/students";
import { loggedIn, setup } from "./helpers";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const group = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).body;
  return { instance, owner, other, book, group };
}

describe("sealing", () => {
  it("round-trips and detects the wrong key or tampering", () => {
    const key = Buffer.alloc(32, 1);
    const sealed = seal(key, "geheim");
    expect(sealed).toMatch(/^k1\./);
    expect(sealed).not.toContain("geheim");
    expect(open(key, sealed)).toBe("geheim");
    expect(open(Buffer.alloc(32, 2), sealed)).toBeNull();
    expect(open(key, sealed.slice(0, -2) + "AA")).toBeNull();
    expect(seal(key, "geheim")).not.toBe(sealed);
  });
});

describe("nextUsernames", () => {
  it("numbers from 01 and continues after existing ones", () => {
    expect(nextUsernames([], "student", 3)).toEqual(["student01", "student02", "student03"]);
    expect(nextUsernames(["student07", "other01"], "student", 2)).toEqual([
      "student08",
      "student09",
    ]);
    expect(nextUsernames(["s98"], "s", 3)).toEqual(["s099", "s100", "s101"]);
  });

  it("skips names that are taken in another form", () => {
    expect(nextUsernames(["a1", "a02"], "a", 2)).toEqual(["a03", "a04"]);
  });
});

describe("groups", () => {
  it("lists groups with student counts and keeps names unique per book", async () => {
    const { owner, book, group } = await world();
    await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 3 });
    expect((await owner.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).status).toBe(409);
    await owner.c.post(`/api/books/${book.id}/groups`, { name: "7b" });
    const list = (await owner.c.get(`/api/books/${book.id}/groups`)).body;
    expect(list.map((g: { name: string; studentCount: number }) => [g.name, g.studentCount])).toEqual([
      ["7a", 3],
      ["7b", 0],
    ]);
  });

  it("is invisible to teachers outside the book", async () => {
    const { other, book, group } = await world();
    expect((await other.c.get(`/api/books/${book.id}/groups`)).status).toBe(404);
    expect((await other.c.get(`/api/groups/${group.id}/students`)).status).toBe(404);
    expect((await other.c.get(`/api/groups/${group.id}/credentials`)).status).toBe(404);
    expect(
      (await other.c.post(`/api/groups/${group.id}/students/generate`, { count: 1 })).status,
    ).toBe(404);
  });

  it("lets editors manage students", async () => {
    const { owner, other, book, group } = await world();
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org" });
    const res = await other.c.post(`/api/groups/${group.id}/students/generate`, { count: 2 });
    expect(res.status).toBe(200);
  });

  it("deletes a group with its students", async () => {
    const { instance, owner, group } = await world();
    await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 2 });
    expect((await owner.c.delete(`/api/groups/${group.id}`)).status).toBe(200);
    expect(instance.db.select().from(students).all()).toEqual([]);
  });
});

describe("students", () => {
  it("generates anonymous accounts with hashed and sealed credentials", async () => {
    const { instance, owner, group } = await world();
    const res = await owner.c.post(`/api/groups/${group.id}/students/generate`, {
      count: 2,
      prefix: "Phy",
      passwordLength: 8,
    });
    expect(res.body.map((s: { username: string }) => s.username)).toEqual(["phy01", "phy02"]);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      "createdAt",
      "groupId",
      "id",
      "lastLoginAt",
      "username",
    ]);

    const row = instance.db.select().from(students).where(eq(students.username, "phy01")).get()!;
    const password = open(instance.config.credentialsKey, row.passwordSealed)!;
    expect(password).toMatch(/^[a-z2-9]{8}$/);
    expect(await verifyPassword(password, row.passwordHash)).toBe(true);
    const key = open(instance.config.credentialsKey, row.loginKeySealed)!;
    expect(sha256(key)).toBe(row.loginKeyHash);
  });

  it("prints credentials with QR login links, and records who looked", async () => {
    const { instance, owner, group } = await world();
    await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 2 });
    const res = await owner.c.get(`/api/groups/${group.id}/credentials`);
    expect(res.body.book).toMatchObject({ title: "Physics", slug: "physics" });
    expect(res.body.loginAddress).toBe("http://physics.books.test");
    expect(res.body.students).toHaveLength(2);
    const [first] = res.body.students;
    expect(first.username).toBe("student01");
    expect(first.password).toMatch(/^[a-z2-9]{6}$/);
    expect(first.loginUrl).toMatch(/^http:\/\/physics\.books\.test\/_hyperbook\/login#k=[\w-]{32}$/);

    // The same values again: lists can be reprinted.
    expect((await owner.c.get(`/api/groups/${group.id}/credentials`)).body.students[0]).toEqual(first);

    const views = instance.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "student.credentials.view"))
      .all();
    expect(views).toHaveLength(2);
    expect(JSON.stringify(views)).not.toContain(first.password);
  });

  it("shows no credentials sealed under another key", async () => {
    const { owner, group, instance } = await world();
    await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 1 });
    instance.db
      .update(students)
      .set({ passwordSealed: seal(Buffer.alloc(32, 9), "x"), loginKeySealed: "garbage" })
      .run();
    const [student] = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body.students;
    expect(student).toMatchObject({ password: null, loginUrl: null });
  });

  it("creates a single student and keeps usernames unique per book", async () => {
    const { owner, book, group } = await world();
    const created = await owner.c.post(`/api/groups/${group.id}/students`, {
      username: "Anna",
      password: "pass1234",
    });
    expect(created.body.username).toBe("anna");
    const other = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7b" })).body;
    expect(
      (await owner.c.post(`/api/groups/${other.id}/students`, { username: "anna" })).status,
    ).toBe(409);

    // Another book may use the same username.
    const book2 = (await owner.c.post("/api/books", { title: "Chem", slug: "chem" })).body;
    const group2 = (await owner.c.post(`/api/books/${book2.id}/groups`, { name: "7a" })).body;
    expect(
      (await owner.c.post(`/api/groups/${group2.id}/students`, { username: "anna" })).status,
    ).toBe(200);
  });

  it("resets a password and regenerates login keys", async () => {
    const { owner, group } = await world();
    const [student] = (
      await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 2 })
    ).body;
    const before = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body.students;

    const reset = await owner.c.put(`/api/students/${student.id}/password`, {});
    expect(reset.body.password).toMatch(/^[a-z2-9]{6}$/);
    await owner.c.post(`/api/students/${student.id}/login-key/regenerate`);
    const after = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body.students;
    expect(after[0].password).toBe(reset.body.password);
    expect(after[0].loginUrl).not.toBe(before[0].loginUrl);
    expect(after[1]).toEqual(before[1]);

    expect((await owner.c.post(`/api/groups/${group.id}/login-keys/regenerate`)).body.count).toBe(2);
    const all = (await owner.c.get(`/api/groups/${group.id}/credentials`)).body.students;
    expect(all[1].loginUrl).not.toBe(before[1].loginUrl);
  });

  it("moves students only within their book", async () => {
    const { owner, book, group } = await world();
    const [student] = (
      await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 1 })
    ).body;
    const b = (await owner.c.post(`/api/books/${book.id}/groups`, { name: "7b" })).body;
    const moved = await owner.c.patch(`/api/students/${student.id}`, { groupId: b.id });
    expect(moved.body.groupId).toBe(b.id);

    const otherBook = (await owner.c.post("/api/books", { title: "Chem", slug: "chem" })).body;
    const foreign = (await owner.c.post(`/api/books/${otherBook.id}/groups`, { name: "x" })).body;
    expect(
      (await owner.c.patch(`/api/students/${student.id}`, { groupId: foreign.id })).status,
    ).toBe(400);
  });

  it("deletes a student", async () => {
    const { owner, other, group } = await world();
    const [student] = (
      await owner.c.post(`/api/groups/${group.id}/students/generate`, { count: 1 })
    ).body;
    expect((await other.c.delete(`/api/students/${student.id}`)).status).toBe(404);
    expect((await owner.c.delete(`/api/students/${student.id}`)).status).toBe(200);
    expect((await owner.c.get(`/api/groups/${group.id}/students`)).body).toEqual([]);
  });
});
