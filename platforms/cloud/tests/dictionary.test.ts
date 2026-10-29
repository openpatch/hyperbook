import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

/** A teacher with a book, as the editor's dictionary calls need. */
async function world(env: Record<string, string> = {}) {
  const instance = setup(env);
  const owner = await loggedIn(instance, {
    email: "o@example.org",
    displayName: "Owner",
  });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
  ).body;
  const words = (path = "") => `/api/books/${book.id}/dictionary${path}`;
  return { instance, owner, other, book, words };
}

describe("dictionary", () => {
  it("starts empty and needs no files", async () => {
    const { owner, words } = await world();
    expect((await owner.c.get(words())).body).toEqual({ words: [] });
  });

  it("adds a word once, and deletes it again", async () => {
    const { owner, words } = await world();
    const res = await owner.c.post(words(), { word: "  StruktoLab " });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ words: ["struktolab"] });
    // Adding it again is fine: the word is simply kept.
    expect((await owner.c.post(words(), { word: "struktolab" })).body).toEqual({
      words: ["struktolab"],
    });
    expect((await owner.c.delete(words("/struktolab"))).body).toEqual({
      words: [],
    });
    expect((await owner.c.get(words())).body).toEqual({ words: [] });
  });

  it("rejects words that are not words", async () => {
    const { owner, words } = await world();
    expect((await owner.c.post(words(), { word: "" })).status).toBe(400);
    expect((await owner.c.post(words(), { word: "two words" })).status).toBe(
      400,
    );
    expect((await owner.c.post(words(), { word: "with.dots" })).status).toBe(
      400,
    );
    expect((await owner.c.post(words(), { word: "a".repeat(65) })).status).toBe(
      400,
    );
    // A long, but real word fits.
    expect(
      (
        await owner.c.post(words(), {
          word: "donaudampfschifffahrtsgesellschaftskapitän",
        })
      ).status,
    ).toBe(200);
  });

  it("keeps each book to its editors", async () => {
    const { owner, other, words } = await world();
    expect((await other.c.get(words())).status).toBe(404);
    expect((await other.c.post(words(), { word: "nope" })).status).toBe(404);
    // The owner is still fine.
    expect((await owner.c.post(words(), { word: "yes" })).status).toBe(200);
  });

  it("goes when the book goes", async () => {
    const { instance, owner, words, book } = await world();
    await owner.c.post(words(), { word: "hyperbook" });
    await owner.c.delete(`/api/books/${book.id}`);
    await instance.builds.idle();
    // The book's dictionary rows followed the book (cascade delete).
    const again = (
      await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
    ).body;
    expect(
      (await owner.c.get(`/api/books/${again.id}/dictionary`)).body,
    ).toEqual({ words: [] });
  });
});
