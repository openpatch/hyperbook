import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createStudentSession, readStudentSession } from "../src/server/auth/student-sessions";
import { books, builds, storeHeads, storeRows, studentSessions } from "../src/server/db/schema";
import { buildDir } from "../src/server/hosting/storage";
import { hrefOfPageFile, workLeftBehind } from "../src/server/domain/overview";
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

async function world({ publish = true, index = INDEX as object } = {}) {
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
    writeFileSync(path.join(dir, "elements.json"), JSON.stringify(index));
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

  it("counts an upload as being in the book", async () => {
    const { instance, teacher, group, students } = await world();
    instance.db.insert(storeHeads).values({ studentId: students[1]!.id, revision: 3, updatedAt: new Date(50_000) }).run();
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body.students[1].lastSeenAt).toBe(50_000);
  });

  it("keeps a session's last-seen time to the minute, also on shared devices", async () => {
    const { instance, book, students } = await world();
    const token = createStudentSession(instance.db, { studentId: students[0]!.id, kind: "cookie", persistent: false });
    const seen = () =>
      instance.db.select().from(studentSessions).where(eq(studentSessions.studentId, students[0]!.id)).get()!;
    const created = seen();
    const t0 = created.lastSeenAt.getTime();
    readStudentSession(instance.db, token, "cookie", book.id, t0 + 30_000);
    expect(seen().lastSeenAt.getTime()).toBe(t0);
    readStudentSession(instance.db, token, "cookie", book.id, t0 + 90_000);
    expect(seen().lastSeenAt.getTime()).toBe(t0 + 90_000);
    // A shared-device session still ends when it was going to.
    expect(seen().expiresAt.getTime()).toBe(created.expiresAt.getTime());
  });

  it("extends a login in steady use", async () => {
    const { instance, book, students } = await world();
    const token = createStudentSession(instance.db, { studentId: students[0]!.id, kind: "cookie", persistent: true });
    const row = () => instance.db.select().from(studentSessions).where(eq(studentSessions.studentId, students[0]!.id)).get()!;
    const t0 = row().lastSeenAt.getTime();
    const end = row().expiresAt.getTime();
    // A request every minute for two hours: last-seen never lags an hour.
    for (let m = 1; m <= 120; m++) readStudentSession(instance.db, token, "cookie", book.id, t0 + m * 60_000 + 1);
    expect(row().expiresAt.getTime()).toBeGreaterThan(end);
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
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="physics-7a.csv"; filename*=UTF-8''physics-7a.csv`,
    );
    const lines = String(res.body).replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Username,Last login,Last seen,Tasks 1 (textinput),Tasks 2 (struktolab),Other saved work");
    expect(lines[1]).toBe("s01,,,2026-11-21T08:30:00.000Z,,0");
    expect(lines).toHaveLength(3);
  });

  it("opens one saved answer read-only", async () => {
    const { teacher, students, row } = await world();
    row(students[0]!.id, "textinput", "q1", 1000, JSON.stringify({ id: "q1", text: "42" }));
    const id = students[0]!.id;
    const res = await teacher.c.get(`/api/students/${id}/element?table=textinput&id=q1`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      rows: [{ table: "textinput", key: "q1", data: { id: "q1", text: "42" }, editedAt: 1000 }],
      editedAt: 1000,
    });
    expect((await teacher.c.get(`/api/students/${id}/element?table=textinput&id=nope`)).status).toBe(404);
  });

  it("finds the files of embedded IDEs by their keys' start and end", async () => {
    const index = {
      version: 1,
      pages: [
        {
          href: "/code",
          title: "Code",
          elements: [
            { id: "java", name: "onlineide", table: "onlineide", match: "prefix" },
            { id: "java2", name: "onlineide", table: "onlineide", match: "prefix" },
            {
              id: "sql",
              name: "sqlide",
              table: "sqlideScripts",
              match: "prefix",
              also: [{ table: "sqlideDatabases", match: "suffix" }],
            },
          ],
        },
      ],
    };
    const { teacher, group, students, row } = await world({ index });
    const ada = students[0]!.id;
    row(ada, "onlineide", "java", 1000, JSON.stringify({ scriptId: "java", script: '["Main.java"]' }));
    row(ada, "onlineide", "javaMain.java", 3000, JSON.stringify({ scriptId: "javaMain.java", script: "class Main {}" }));
    // "java2…" belongs to the second IDE, not to "java".
    row(ada, "onlineide", "java2Main.java", 2000, JSON.stringify({ scriptId: "java2Main.java", script: "x" }));
    row(ada, "sqlideDatabases", "https://example.org/school.dbsql", 4000, JSON.stringify({ databaseId: "x", statements: "[]" }));

    const overview = (await teacher.c.get(`/api/groups/${group.id}/overview`)).body;
    expect(overview.students[0]).toMatchObject({
      cells: { "onlineide/java": 3000, "onlineide/java2": 2000, "sqlideScripts/sql": 4000 },
      elsewhere: 0,
    });

    const java = (await teacher.c.get(`/api/students/${ada}/element?table=onlineide&id=java`)).body;
    expect(java.rows.map((r: { key: string }) => r.key)).toEqual(["java", "javaMain.java"]);
    expect(java.editedAt).toBe(3000);
    const sql = (await teacher.c.get(`/api/students/${ada}/element?table=sqlideScripts&id=sql`)).body;
    expect(sql.rows).toEqual([expect.objectContaining({ table: "sqlideDatabases" })]);
  });

  it("narrows the CSV to a section and to pages with work", async () => {
    const index = {
      version: 1,
      pages: [
        { href: "/a", title: "A", sections: ["OOP", "Classes"], elements: [{ id: "a1", name: "textinput", table: "textinput" }] },
        { href: "/b", title: "B", sections: ["OOP", "Lists"], elements: [{ id: "b1", name: "textinput", table: "textinput" }] },
        { href: "/c", title: "C", sections: ["OOP", "Classes"], elements: [{ id: "c1", name: "textinput", table: "textinput" }] },
      ],
    };
    const { teacher, group, students, row } = await world({ index });
    row(students[0]!.id, "textinput", "a1", 1000);
    row(students[0]!.id, "textinput", "b1", 1000);
    const header = async (query: string) =>
      String((await teacher.c.get(`/api/groups/${group.id}/overview.csv${query}`)).body)
        .replace(/^\uFEFF/, "")
        .split("\r\n")[0];
    const section = encodeURIComponent(JSON.stringify(["OOP", "Classes"]));
    expect(await header("")).toContain("A 1 (textinput),B 1 (textinput),C 1 (textinput)");
    expect(await header(`?section=${section}`)).toContain("A 1 (textinput),C 1 (textinput),");
    expect(await header(`?section=${section}&worked=1`)).toBe(
      "Username,Last login,Last seen,A 1 (textinput),Other saved work",
    );
  });

  it("lists a student's work that belongs to no task of the live version", async () => {
    const { teacher, students, row } = await world();
    const id = students[0]!.id;
    row(id, "textinput", "q1", 1000, JSON.stringify({ id: "q1", text: "kept" }));
    row(id, "textinput", "old-q", 2000, JSON.stringify({ id: "old-q", text: "before the edit" }));
    row(id, "tabs", "t", 3000); // how the page looked: never listed
    const res = await teacher.c.get(`/api/students/${id}/elsewhere`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([
      { table: "textinput", key: "old-q", data: { id: "old-q", text: "before the edit" }, editedAt: 2000, task: "textinput/old-q" },
    ]);
  });

  it("finds the work a newer save would leave without its task", async () => {
    const { instance, book, students, row } = await world();
    row(students[0]!.id, "struktolab", "s1", 1000);
    row(students[1]!.id, "struktolab", "s1", 1000);
    row(students[1]!.id, "textinput", "q1", 1000);
    const bookRow = instance.db.select().from(books).where(eq(books.id, book.id)).get()!;
    // The newer save still has q1, but s1 was changed (new id) or removed.
    const next = [{ elements: [{ id: "q1", name: "textinput", table: "textinput" }, { id: "s1-new", name: "struktolab", table: "struktolab" }] }];
    expect(workLeftBehind(instance.db, instance.config, bookRow, next)).toEqual([
      { href: "/tasks", title: "Tasks", name: "struktolab", table: "struktolab", id: "s1", students: 2 },
    ]);
    // Nothing is left behind when every task is still there.
    const same = [{ elements: INDEX.pages[0]!.elements }];
    expect(workLeftBehind(instance.db, instance.config, bookRow, same)).toEqual([]);
  });

  it("counts checklist items and ABC tunes as tasks, not as other work", async () => {
    const index = {
      version: 1,
      pages: [
        {
          href: "/tasks",
          title: "Tasks",
          elements: [
            { id: ":c1", name: "checklist", table: "checklist", match: "suffix" },
            { id: "abc", name: "abc-music", table: "abcMusic" },
          ],
        },
      ],
    };
    const { teacher, group, students, row } = await world({ index });
    row(students[0]!.id, "checklist", "markdown-checklist:/tasks:c1", 1000, JSON.stringify({ checked: true }));
    row(students[0]!.id, "abcMusic", "abc", 2000, JSON.stringify({ id: "abc", tune: "CDEF|" }));
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body.students[0]).toMatchObject({
      cells: { "checklist/:c1": 1000, "abcMusic/abc": 2000 },
      elsewhere: 0,
    });
  });

  it("reads an index it partly does not understand, without empty pages", async () => {
    const index = {
      version: 2,
      pages: [
        { href: "/a", title: "A", elements: [{ id: "q1", name: "textinput", table: "textinput" }, { id: 7 }] },
        { href: "/empty", title: "Empty", elements: [] },
        { title: "No href", elements: [{ id: "x", name: "textinput", table: "textinput" }] },
      ],
    };
    const { teacher, group } = await world({ index });
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body.indexed).toBe(true);
    expect(res.body.pages).toEqual([{ href: "/a", title: "A", elements: [{ id: "q1", name: "textinput", table: "textinput" }] }]);
  });

  it("leaves out the pages a client already has, and is never cached", async () => {
    const { teacher, group } = await world();
    const first = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(first.body.pages).toHaveLength(1);
    const again = await teacher.c.get(`/api/groups/${group.id}/overview?known=${first.body.buildId}`);
    expect(again.body.pages).toBeNull();
    expect((await teacher.c.get(`/api/groups/${group.id}/overview?known=999`)).body.pages).toHaveLength(1);
  });

  it("keeps formulas and line breaks out of the CSV's cells, and takes worked=0", async () => {
    const index = {
      version: 1,
      pages: [{ href: "/a", title: "=HYPERLINK(\"x\")\r\nB", elements: [{ id: "q1", name: "textinput", table: "textinput" }] }],
    };
    const { teacher, group } = await world({ index });
    const res = await teacher.c.get(`/api/groups/${group.id}/overview.csv?worked=0`);
    expect(res.status).toBe(200);
    expect(res.headers.get("vary")).toContain("Accept-Language");
    const header = String(res.body).replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(header).toContain(`"'=HYPERLINK(""x"")`);
  });

  it("counts other work by task: an IDE's files are one task", async () => {
    const { teacher, group, students, row } = await world();
    const id = students[0]!.id;
    // A removed Online-IDE: its file list, two files and its workspace.
    row(id, "onlineide", "java", 1000);
    row(id, "onlineide", "javaMain.java", 1000);
    row(id, "onlineide", "javaHelper.java", 1000);
    row(id, "onlineide", "java-workspace", 1000);
    // A removed SQL-IDE with a changed database.
    row(id, "sqlideScripts", "sql", 1000);
    row(id, "sqlideScripts", "sqlAbfrage.sql", 1000);
    row(id, "sqlideDatabases", "https://example.org/school.dbsql", 1000);
    const res = await teacher.c.get(`/api/groups/${group.id}/overview`);
    expect(res.body.students[0].elsewhere).toBe(2);
    const rows = (await teacher.c.get(`/api/students/${id}/elsewhere`)).body.rows as { task: string }[];
    expect([...new Set(rows.map((r) => r.task))]).toEqual(["onlineide/java", "sqlideScripts/sql"]);
  });

  it("tries a failed index read again instead of remembering it", async () => {
    const { instance, teacher, group, book } = await world();
    const live = instance.db.select().from(books).where(eq(books.id, book.id)).get()!;
    const file = path.join(buildDir(instance.config, book.id, live.publishedBuildId!), "_hyperbook", "elements.json");
    // Unreadable for a moment (here: a directory in its place).
    rmSync(file);
    mkdirSync(file);
    expect((await teacher.c.get(`/api/groups/${group.id}/overview`)).body.indexed).toBe(false);
    rmSync(file, { recursive: true });
    writeFileSync(file, JSON.stringify(INDEX));
    expect((await teacher.c.get(`/api/groups/${group.id}/overview`)).body.indexed).toBe(true);
  });

  it("does not count the tasks of a page that failed to render as gone", async () => {
    const { instance, book, students, row } = await world();
    row(students[0]!.id, "textinput", "q1", 1000);
    const bookRow = instance.db.select().from(books).where(eq(books.id, book.id)).get()!;
    // The save's check could not render /tasks, so it reports no tasks for it.
    expect(workLeftBehind(instance.db, instance.config, bookRow, [], [])).toHaveLength(1);
    expect(workLeftBehind(instance.db, instance.config, bookRow, [], ["/tasks"])).toEqual([]);
  });

  it("names a page file by the address the index uses", () => {
    expect(hrefOfPageFile("book/index.md")).toBe("/");
    expect(hrefOfPageFile("book/tasks.md")).toBe("/tasks");
    expect(hrefOfPageFile("book/oop/index.md.hbs")).toBe("/oop");
    expect(hrefOfPageFile("book/oop/fields.md.yml")).toBe("/oop/fields");
    expect(hrefOfPageFile("glossary/term.md")).toBe("/glossary/term");
  });

  it("keeps umlauts in the CSV's file name", async () => {
    const { teacher, book } = await world();
    const group = (await teacher.c.post(`/api/books/${book.id}/groups`, { name: "Klasse 7ä" })).body;
    const res = await teacher.c.get(`/api/groups/${group.id}/overview.csv`);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="physics-Klasse_7_.csv"; filename*=UTF-8''${encodeURIComponent("physics-Klasse 7ä.csv")}`,
    );
  });

  it("is for the book's editors only", async () => {
    const { instance, group, students, row } = await world();
    row(students[0]!.id, "textinput", "q1", 1000);
    const other = await loggedIn(instance, { email: "x@example.org" });
    expect((await other.c.get(`/api/groups/${group.id}/overview`)).status).toBe(404);
    expect((await other.c.get(`/api/students/${students[0]!.id}/element?table=textinput&id=q1`)).status).toBe(404);
  });
});
