import { describe, expect, it } from "vitest";
import { ADMIN_HOST, loggedIn, setup } from "./helpers";

/*
 * Keeping open editors in step: the event stream that says when main moves,
 * and the three-way merge of unsaved text with the version saved since.
 */

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Owner" });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const files = (path = "") => `/api/books/${book.id}/files${path}`;
  const listing = (await owner.c.post(files("/init"), { template: "empty" })).body;
  const oid = listing.files.find((f: { path: string }) => f.path === "book/index.md").oid as string;
  return { instance, owner, other, book, files, listing, oid };
}

/** Opens the book's event stream; `next()` resolves to its next event. */
function events(instance: ReturnType<typeof setup>, bookId: number, cookie: string) {
  const abort = new AbortController();
  const response = instance.app.request(`/api/books/${bookId}/events`, {
    headers: { host: ADMIN_HOST, cookie },
    signal: abort.signal,
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let buffer = "";
  const decoder = new TextDecoder();
  async function next(): Promise<{ event: string; data: any }> {
    if (!reader) {
      const res = await response;
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
      reader = res.body!.getReader();
    }
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (event && data !== undefined) return { event, data: JSON.parse(data) };
        continue;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended");
      buffer += decoder.decode(value, { stream: true });
    }
  }
  return { next, close: () => abort.abort(), status: async () => (await response).status };
}

describe("book events", () => {
  it("starts with main's commit and tells of every save", async () => {
    const { instance, owner, book, files, listing, oid } = await world();
    const stream = events(instance, book.id, owner.c.cookie);
    try {
      expect(await stream.next()).toEqual({ event: "head", data: { commit: listing.commit } });
      const saved = (
        await owner.c.post(files("/commit"), {
          changes: [{ op: "write", path: "book/index.md", content: "# Changed", baseOid: oid }],
        })
      ).body;
      expect(await stream.next()).toEqual({
        event: "change",
        data: { commit: saved.commit, by: "Owner", via: "editor" },
      });
    } finally {
      stream.close();
    }
  });

  it("is open to commenters, who read along", async () => {
    const { instance, owner, book, listing } = await world();
    const commenter = await loggedIn(instance, { email: "c@example.org" });
    await owner.c.post(`/api/books/${book.id}/members`, { email: "c@example.org", role: "commenter" });
    const stream = events(instance, book.id, commenter.c.cookie);
    try {
      expect(await stream.next()).toEqual({ event: "head", data: { commit: listing.commit } });
    } finally {
      stream.close();
    }
  });

  it("is only for members of the book", async () => {
    const { instance, other, book } = await world();
    const stream = events(instance, book.id, other.c.cookie);
    expect(await stream.status()).toBe(404);
    stream.close();
  });
});

describe("merging", () => {
  it("merges unsaved text with the version saved since", async () => {
    const { owner, files, oid } = await world();
    const base = "one\ntwo\nthree\nfour\nfive\n";
    const first = (
      await owner.c.post(files("/commit"), {
        changes: [{ op: "write", path: "book/index.md", content: base, baseOid: oid }],
      })
    ).body;
    const baseOid = first.files.find((f: { path: string }) => f.path === "book/index.md").oid;
    // Someone else changes the start, while the editor holds a change at the end.
    await owner.c.post(files("/commit"), {
      changes: [{ op: "write", path: "book/index.md", content: base.replace("one", "ONE"), baseOid }],
    });
    const res = await owner.c.post(files("/merge"), {
      path: "book/index.md",
      baseOid,
      text: base.replace("five", "FIVE"),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deleted: false,
      conflicts: 0,
      merged: "ONE\ntwo\nthree\nfour\nFIVE\n",
      theirs: "ONE\ntwo\nthree\nfour\nfive\n",
      by: { name: "Owner" },
    });
    expect(res.body.diff).toContain("-one");
    expect(res.body.diff).toContain("+ONE");
  });

  it("marks what both changed", async () => {
    const { owner, files, oid } = await world();
    const saved = (
      await owner.c.post(files("/commit"), {
        changes: [{ op: "write", path: "book/index.md", content: "a\nb\nc\n", baseOid: oid }],
      })
    ).body;
    const baseOid = saved.files.find((f: { path: string }) => f.path === "book/index.md").oid;
    await owner.c.post(files("/commit"), {
      changes: [{ op: "write", path: "book/index.md", content: "a\ntheirs\nc\n", baseOid }],
    });
    const res = await owner.c.post(files("/merge"), { path: "book/index.md", baseOid, text: "a\nmine\nc\n" });
    expect(res.body.conflicts).toBe(1);
    expect(res.body.merged).toMatch(/^<{7} your version\nmine\n={7}\ntheirs\n>{7} their version\n/m);
  });

  it("says when the file is gone", async () => {
    const { owner, files, oid } = await world();
    await owner.c.post(files("/commit"), { changes: [{ op: "delete", path: "book/index.md", baseOid: oid }] });
    const res = await owner.c.post(files("/merge"), { path: "book/index.md", baseOid: oid, text: "x" });
    expect(res.body).toMatchObject({ deleted: true });
  });

  it("is for editors of the book", async () => {
    const { other, files, oid } = await world();
    const res = await other.c.post(files("/merge"), { path: "book/index.md", baseOid: oid, text: "x" });
    expect(res.status).toBe(404);
  });
});
