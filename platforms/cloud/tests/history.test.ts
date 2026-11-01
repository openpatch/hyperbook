import { describe, expect, it } from "vitest";
import { loggedIn, setup } from "./helpers";

/*
 * The History pane's API: pages of the book's commits (author, message,
 * +N -N) and one commit's diff. Every save is a commit, so the tests build
 * their history through the editor's own save route.
 */

async function world(env: Record<string, string> = {}) {
  const instance = setup(env);
  const owner = await loggedIn(instance, {
    email: "o@example.org",
    displayName: "Owner",
  });
  const stranger = await loggedIn(instance, { email: "x@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
  ).body;
  const files = (path = "") => `/api/books/${book.id}/files${path}`;
  const history = (query = "") => `/api/books/${book.id}/history${query}`;
  return { instance, owner, stranger, book, files, history };
}

type Listing = { commit: string; files: { path: string; oid: string }[] };

const oidOf = (listing: Listing, path: string) =>
  listing.files.find((f) => f.path === path)?.oid ?? null;

/** Saves one file; returns the new listing. */
async function write(
  post: (
    path: string,
    body: unknown,
  ) => Promise<{ status: number; body: unknown }>,
  files: string,
  path: string,
  content: string,
  message: string,
  listing?: Listing,
): Promise<Listing> {
  const res = await post(`${files}/commit`, {
    message,
    changes: [
      {
        op: "write",
        path,
        content,
        baseOid: listing ? oidOf(listing, path) : null,
      },
    ],
  });
  expect(res.status).toBe(200);
  return res.body as Listing;
}

describe("history", () => {
  it("lists commits with author, message and line counts", async () => {
    const { owner, files, history } = await world();
    let listing = (await owner.c.post(files("/init"), { template: "empty" }))
      .body as Listing;
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "one\ntwo\n",
      "Add two lines",
      listing,
    );
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "one\n",
      "Remove a line",
      listing,
    );
    // A binary file (git decides by the NUL byte): it is in the commit, but
    // counts no lines.
    const binary = await owner.c.post(files("/commit"), {
      message: "Add an image",
      changes: [
        {
          op: "write",
          path: "logo.png",
          encoding: "base64",
          content: Buffer.from([137, 80, 0, 71]).toString("base64"),
          baseOid: null,
        },
      ],
    });
    expect(binary.status).toBe(200);
    await write(owner.c.post, files(), "b.md", "hello\n", "Add b", listing);

    const res = await owner.c.get(history());
    expect(res.status).toBe(200);
    const commits = res.body.commits;
    expect(commits).toHaveLength(5); // init + 4 saves
    // Newest first, with the save's author and message.
    expect(commits[0]).toMatchObject({
      name: "Owner",
      email: "o@example.org",
      message: "Add b",
      additions: 1,
      deletions: 0,
    });
    expect(commits[1]).toMatchObject({
      message: "Add an image",
      additions: 0,
      deletions: 0,
    });
    expect(commits[2]).toMatchObject({
      message: "Remove a line",
      additions: 0,
      deletions: 1,
    });
    expect(commits[3]).toMatchObject({
      message: "Add two lines",
      additions: 2,
      deletions: 0,
    });
    expect(commits[4].message).toBe("Start the book");
    // An ISO date, as %aI writes it.
    expect(new Date(commits[0].date).toString()).not.toBe("Invalid Date");
    // Fewer than a full page: no next page.
    expect(res.body.next).toBeNull();
  });

  it("pages the history with a cursor", async () => {
    const { owner, files, history } = await world();
    let listing = (await owner.c.post(files("/init"), { template: "empty" }))
      .body as Listing;
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "1\n",
      "First",
      listing,
    );
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "1\n2\n",
      "Second",
      listing,
    );
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "1\n2\n3\n",
      "Third",
      listing,
    );
    await write(
      owner.c.post,
      files(),
      "a.txt",
      "1\n2\n3\n4\n",
      "Fourth",
      listing,
    );

    // The whole history is 5 commits: init and four saves.
    const page1 = (await owner.c.get(history("?limit=2"))).body;
    expect(page1.commits.map((c: { message: string }) => c.message)).toEqual([
      "Fourth",
      "Third",
    ]);
    const page2 = (await owner.c.get(history(`?limit=2&after=${page1.next}`)))
      .body;
    expect(page2.commits.map((c: { message: string }) => c.message)).toEqual([
      "Second",
      "First",
    ]);
    // The last page ends the paging.
    const page3 = (await owner.c.get(history(`?limit=2&after=${page2.next}`)))
      .body;
    expect(page3.commits.map((c: { message: string }) => c.message)).toEqual([
      "Start the book",
    ]);
    expect(page3.next).toBeNull();
    // No page after the end: the same cursor again, and nothing older.
    const page4 = (
      await owner.c.get(history(`?limit=2&after=${page3.commits[0].sha}`))
    ).body;
    expect(page4).toEqual({ commits: [], next: null });
    // A cursor that no longer exists (history rewritten by a push) ends it too.
    const unknown = "e".repeat(40);
    expect(
      (await owner.c.get(history(`?limit=2&after=${unknown}`))).body,
    ).toEqual({
      commits: [],
      next: null,
    });
    // The page size is bounded.
    expect((await owner.c.get(history("?limit=0"))).status).toBe(400);
    expect((await owner.c.get(history("?limit=101"))).status).toBe(400);
  });

  it("keeps only the commits that touched a file", async () => {
    const { owner, files, history } = await world();
    let listing = (await owner.c.post(files("/init"), { template: "empty" }))
      .body as Listing;
    listing = await write(
      owner.c.post,
      files(),
      "book/page.md",
      "A page.\n",
      "Add the page",
      listing,
    );
    listing = await write(
      owner.c.post,
      files(),
      "other.md",
      "Other.\n",
      "Add other",
      listing,
    );
    await write(
      owner.c.post,
      files(),
      "book/page.md",
      "A page!\n",
      "Edit the page",
      listing,
    );

    const res = await owner.c.get(history("?path=book/page.md"));
    expect(res.status).toBe(200);
    expect(res.body.commits.map((c: { message: string }) => c.message)).toEqual(
      ["Edit the page", "Add the page"],
    );
    // The counts are that file's, not the whole commit's.
    expect(res.body.commits[0]).toMatchObject({ additions: 1, deletions: 1 });
    // A file no commit ever touched has no history.
    const none = await owner.c.get(history("?path=nope.md"));
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ commits: [], next: null });
  });

  it("shows a commit's diff, and only commits of the book", async () => {
    const { owner, files, history } = await world();
    let listing = (await owner.c.post(files("/init"), { template: "empty" }))
      .body as Listing;
    listing = await write(
      owner.c.post,
      files(),
      "a.txt",
      "one\n",
      "First",
      listing,
    );
    await write(
      owner.c.post,
      files(),
      "a.txt",
      "one\ntwo\n",
      "Second",
      listing,
    );

    const commits = (await owner.c.get(history())).body.commits;
    const res = await owner.c.raw("GET", `${history()}/${commits[0].sha}/diff`);
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe(commits[0].sha);
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.body.diff).toContain("+two");
    expect(res.body.diff).toContain("a.txt");

    // The first commit is diffed against the empty tree.
    const first = await owner.c.raw(
      "GET",
      `${history()}/${commits[commits.length - 1].sha}/diff`,
    );
    expect(first.status).toBe(200);
    expect(first.body.diff).toContain("+{");

    // A well-formed sha that is not one of the book's commits.
    expect(
      (await owner.c.get(`${history()}/${"0".repeat(40)}/diff`)).status,
    ).toBe(404);
    expect((await owner.c.get(`${history()}/xyz/diff`)).status).toBe(400);
  });

  it("is only for members of the book", async () => {
    const { owner, stranger, files, history } = await world();
    await owner.c.post(files("/init"), { template: "empty" });
    // Not a member: the book is not even there to them.
    expect((await stranger.c.get(history())).status).toBe(404);
    const listing = (await owner.c.get(files())).body;
    expect(
      (await stranger.c.get(`${history()}/${listing.commit}/diff`)).status,
    ).toBe(404);
  });
});
