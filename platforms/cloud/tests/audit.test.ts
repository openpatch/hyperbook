import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

describe("activity log", () => {
  it("lists what happened, newest first, in pages, for admins only", async () => {
    const instance = setup();
    const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    const teacher = await loggedIn(instance, { email: "t@example.org" });
    const book = (await teacher.c.post("/api/books", { title: "Physics", slug: "physics" })).body;

    expect((await teacher.c.get("/api/audit")).status).toBe(403);

    const first = await admin.c.get("/api/audit?limit=2");
    expect(first.body.entries.map((e: { action: string }) => e.action)).toEqual([
      "book.create",
      "login",
    ]);
    expect(first.body.entries[0]).toMatchObject({
      actorEmail: "t@example.org",
      targetType: "book",
      targetId: book.id,
      data: { slug: "physics", title: "Physics" },
    });
    const second = await admin.c.get(`/api/audit?limit=2&before=${first.body.next}`);
    expect(second.body.entries.map((e: { action: string }) => e.action)).toEqual(["login"]);
    expect(second.body.next).toBeNull();
  });
});
