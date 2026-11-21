import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { books, builds, storeRows, studentSessions } from "../src/server/db/schema";
import { buildDir } from "../src/server/hosting/storage";
import { loggedIn, setup } from "./helpers";

const INDEX = {
  version: 1,
  pages: [
    {
      href: "/tasks",
      title: "Tasks",
      elements: [
        { id: "q1", name: "textinput", table: "textinput" },
        { id: "s1", name: "struktolab", table: "struktolab" },
      ],
    },
  ],
};

async function world({ publish = true } = {}) {
  const instance = setup();
  const teacher = await loggedIn(instance, { email: "t@example.org" });
  const book = (await teacher.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const group = (await teacher.c.post(`/api/books/${book.id}/groups`, { name: "7a" })).body;
  await teacher.c.post(`/api/groups/${group.id}/students/generate`, { count: 2, prefix: "s", passwordLength: 6 });
  const students = (await teacher.c.get(`/api/groups/${group.id}/students`)).body as { id: number; username: string }[];
  if (publish) {
    const build = instance.db
      .insert(builds)
      .values({ bookId: book.id, commit: "a".repeat(40), status: "succeeded", trigger: "publish" })
      .returning()
      .get();
    const dir = path.join(buildDir(instance.config, book.id, build.id), "_hyperbook");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "elements.json"), JSON.stringify(INDEX));
    instance.db.update(books).set({ publishedBuildId: build.id }).where(eq(books.id, book.id)).run();
  }
  const row = (studentId: number, tableName: string, key: unknown, editedAt: number, data: string | null = "{}") =>
    instance.db
      .insert(storeRows)
      .values({ studentId, tableName, key: JSON.stringify(key), data, revision: 1, editedAt, updatedAt: new Date() })
      .run();
  return { instance, teacher, book, group, students, row };
}

describe("the group overview", () => {
  it("shows when each student last changed each element of the live version", async () => {
    const { teacher, group, students, row } = await world();
    const [s1, s2] = students;
    row(s1!.id, "textinput", "q1", 1000);
    row(s1!.id, "struktolab", "s1", 2000);
    row(s1!.id, "tabs", "t", 3000); // how the page looks, not work
    row(s1!.id, "textinput", "gone", 4000); // an element no longer in the book
    row(s2!.id, "textinput", "q1", 5000, null); // deleted: not worked on

    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.status).toBe(200);
    expect(res.body.indexed).toBe(true);
    expect(res.body.pages).toEqual(INDEX.pages);
    expect(res.body.students).toEqual([
      expect.objectContaining({ username: "s01", cells: { "textinput/q1": 1000, "struktolab/s1": 2000 }, elsewhere: 1 }),
      expect.objectContaining({ username: "s02", cells: {}, elsewhere: 0 }),
    ]);
  });

  it("knows when a student was last online, but not a teacher viewing their work", async () => {
    const { instance, teacher, group, students } = await world();
    const session = (at: number, impersonatedBy: number | null) =>
      instance.db
        .insert(studentSessions)
        .values({
          idHash: `h${at}`,
          studentId: students[0]!.id,
          kind: "cookie",
          impersonatedBy,
          expiresAt: new Date(at + 1e9),
          lastSeenAt: new Date(at),
        })
        .run();
    session(10_000, null);
    session(20_000, teacher.user.id);
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body.students[0].lastSeenAt).toBe(10_000);
    expect(res.body.students[1].lastSeenAt).toBeNull();
  });

  it("counts all work as elsewhere while nothing is published", async () => {
    const { teacher, group, students, row } = await world({ publish: false });
    row(students[0]!.id, "textinput", "q1", 1000);
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body).toMatchObject({ indexed: false, pages: [] });
    expect(res.body.students[0]).toMatchObject({ cells: {}, elsewhere: 1 });
  });

  it("exports the overview as CSV", async () => {
    const { teacher, group, students, row } = await world();
    row(students[0]!.id, "textinput", "q1", Date.UTC(2026, 10, 21, 8, 30));
    const res = await teacher.c.get(`/api/groups/${group.id}/overview.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = String(res.body).replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Username,Last login,Last seen,Tasks 1 (textinput),Tasks 2 (struktolab),Other saved work");
    expect(lines[1]).toBe("s01,,,2026-11-21T08:30:00.000Z,,0");
    expect(lines).toHaveLength(3);
  });

  it("is for the book's editors only", async () => {
    const { instance, group } = await world();
    const other = await loggedIn(instance, { email: "x@example.org" });
    expect((await other.c.get(`/api/groups/${group.id}/overview`)).status).toBe(404);
  });
});
