import { describe, expect, it } from "vitest";
import { DIGEST_INTERVAL_MS, sendCommentDigests } from "../src/server/domain/comment-mail";
import { relocate, textOf } from "../src/server/domain/comments";
import { client, loggedIn, setup } from "./helpers";

const PAGE = "# Physics\n\nForce is mass times acceleration.\n\nEnergy is conserved.\n";

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, { email: "o@example.org", displayName: "Olivia" });
  const editor = await loggedIn(instance, { email: "e@example.org", displayName: "Emil" });
  const commenter = await loggedIn(instance, { email: "c@example.org", displayName: "Cem" });
  const book = (await owner.c.post("/api/books", { title: "Physics", slug: "physics" })).body;
  const base = `/api/books/${book.id}`;
  await owner.c.post(`${base}/members`, { email: "e@example.org", role: "editor" });
  await owner.c.post(`${base}/members`, { email: "c@example.org", role: "commenter" });
  await owner.c.post(`${base}/files/init`, { template: "empty" });
  const write = async (content: string, path = "book/index.md", as = owner) => {
    const files = (await as.c.get(`${base}/files`)).body.files as { path: string; oid: string }[];
    const res = await as.c.post(`${base}/files/commit`, {
      changes: [{ op: "write", path, content, baseOid: files.find((f) => f.path === path)?.oid ?? null }],
    });
    expect(res.status).toBe(200);
    return res.body.files.find((f: { path: string }) => f.path === path).oid as string;
  };
  const oid = await write(PAGE);
  /** Starts a thread on the first occurrence of `quote`. */
  const comment = (as: typeof owner, quote: string, body = "Why?", extra: Record<string, unknown> = {}, at = oid) => {
    const from = PAGE.indexOf(quote);
    return as.c.post(`${base}/comments`, {
      anchor: { path: "book/index.md", oid: at, from, to: from + quote.length },
      body,
      ...extra,
    });
  };
  const threads = async (as = owner, path?: string) =>
    (await as.c.get(`${base}/comments${path ? `?path=${encodeURIComponent(path)}` : ""}`)).body.threads;
  return { instance, owner, editor, commenter, book, base, oid, write, comment, threads };
}

describe("relocate", () => {
  const anchor = (text: string, quote: string, nth = 0) => {
    let from = -1;
    for (let i = 0; i <= nth; i++) from = text.indexOf(quote, from + 1);
    return {
      anchorFrom: from,
      anchorExact: quote,
      anchorPrefix: text.slice(Math.max(0, from - 32), from),
      anchorSuffix: text.slice(from + quote.length, from + quote.length + 32),
    };
  };

  it("follows text that moved and picks the right one of twins by its context", () => {
    const text = "alpha beta gamma\nbeta delta\n";
    const second = anchor(text, "beta", 1);
    const changed = "new line\nalpha beta gamma\nbeta delta\n";
    expect(relocate(changed, second)).toEqual({ from: changed.lastIndexOf("beta"), to: changed.lastIndexOf("beta") + 4 });
    expect(relocate("nothing here", second)).toBeNull();
  });

  it("counts Windows line breaks as one character, like the editor", () => {
    expect(textOf(Buffer.from("a\r\nb\rc\n"))).toBe("a\nb\nc\n");
    expect(textOf(Buffer.from([0x50, 0x00, 0x4e]))).toBeNull();
  });
});

describe("comments", () => {
  it("start threads on a range of a file and list them", async () => {
    const { commenter, owner, comment, threads } = await world();
    const res = await comment(commenter, "mass times acceleration", "Add units?");
    expect(res.status).toBe(200);
    const [thread] = await threads(commenter, "book/index.md");
    expect(thread).toMatchObject({
      path: "book/index.md",
      from: PAGE.indexOf("mass times"),
      quote: "mass times acceleration",
      outdated: false,
      status: "open",
      createdBy: "Cem",
      canResolve: true,
      comments: [{ author: "Cem", body: "Add units?", mine: true, deleted: false }],
    });
    // The owner sees it as someone else's, and may resolve it.
    expect((await threads(owner))[0]).toMatchObject({ canResolve: true, comments: [{ mine: false }] });
    expect(await threads(owner, "book/other.md")).toEqual([]);
  });

  it("refuse ranges in text the editor does not have", async () => {
    const { commenter, comment, base, write } = await world();
    const newer = await write(PAGE + "More.\n");
    expect((await comment(commenter, "Energy", "x", {}, "0".repeat(40))).status).toBe(409);
    expect(newer).toMatch(/^[0-9a-f]{40}$/);
    const outside = await commenter.c.post(`${base}/comments`, {
      anchor: { path: "book/index.md", oid: newer, from: 1, to: 10_000 },
      body: "x",
    });
    expect(outside.status).toBe(400);
    const missing = await commenter.c.post(`${base}/comments`, {
      anchor: { path: "book/nope.md", oid: newer, from: 0, to: 1 },
      body: "x",
    });
    expect(missing.status).toBe(404);
    expect((await comment(commenter, "Energy", "  ", {}, newer)).status).toBe(400);
  });

  it("let authors change and delete only their own comments", async () => {
    const { commenter, editor, comment, threads, base } = await world();
    const { threadId } = (await comment(commenter, "Energy", "First")).body;
    const reply = await editor.c.post(`${base}/comments/${threadId}/replies`, { body: "Second" });
    expect(reply.status).toBe(200);
    const [first, second] = (await threads())[0].comments;
    expect((await editor.c.patch(`${base}/comments/c/${first.id}`, { body: "Hijacked" })).status).toBe(403);
    expect((await commenter.c.patch(`${base}/comments/c/${first.id}`, { body: "First, edited" })).status).toBe(200);
    expect((await commenter.c.delete(`${base}/comments/c/${second.id}`)).status).toBe(403);
    expect((await editor.c.delete(`${base}/comments/c/${second.id}`)).status).toBe(200);
    expect((await threads())[0].comments).toMatchObject([
      { body: "First, edited", deleted: false },
      { body: "", deleted: true },
    ]);
    expect((await editor.c.delete(`${base}/comments/c/${second.id}`)).status).toBe(404);
  });

  it("are resolved by editors, owners, and whoever started them", async () => {
    const { instance, commenter, editor, owner, comment, threads, base } = await world();
    const mine = (await comment(commenter, "Energy", "Mine")).body.threadId;
    const theirs = (await comment(owner, "Physics", "Theirs")).body.threadId;
    expect((await commenter.c.post(`${base}/comments/${theirs}/resolve`)).status).toBe(403);
    expect((await commenter.c.post(`${base}/comments/${mine}/resolve`)).status).toBe(200);
    expect((await commenter.c.post(`${base}/comments/${mine}/reopen`)).status).toBe(200);
    expect((await editor.c.post(`${base}/comments/${theirs}/resolve`)).status).toBe(200);
    const all = await threads(commenter);
    expect(all.find((t: { id: number }) => t.id === theirs)).toMatchObject({
      status: "resolved",
      resolvedBy: "Emil",
      canResolve: false,
    });
    // Strangers see nothing.
    const stranger = await loggedIn(instance, { email: "s@example.org" });
    expect((await stranger.c.get(`${base}/comments`)).status).toBe(404);
    expect((await client(instance).get(`${base}/comments`)).status).toBe(401);
  });

  it("follow their text through saves, and go outdated when it is gone", async () => {
    const { commenter, comment, threads, write } = await world();
    await comment(commenter, "Energy is conserved", "Always?");
    // A save that does not send positions (a push, the AI): found again.
    await write("Intro.\n\n" + PAGE);
    expect((await threads())[0]).toMatchObject({
      from: ("Intro.\n\n" + PAGE).indexOf("Energy"),
      quote: "Energy is conserved",
      outdated: false,
    });
    await write("# Physics\n\nAll new.\n");
    expect((await threads())[0]).toMatchObject({ outdated: true, quote: "Energy is conserved" });
  });

  it("take the editor's positions after a save, and follow moves", async () => {
    const { editor, commenter, comment, threads, write, base } = await world();
    const { threadId } = (await comment(commenter, "Energy is conserved", "Always?")).body;
    // The commented text itself is edited, so it cannot be found again…
    const text = PAGE.replace("Energy is conserved", "Energy is always conserved");
    const oid = await write(text, "book/index.md", editor);
    const from = text.indexOf("Energy");
    // …but the editor knows where it went.
    const to = from + "Energy is always conserved".length;
    expect(
      (await commenter.c.post(`${base}/comments/anchors`, {
        path: "book/index.md",
        oid,
        anchors: [{ threadId, from, to }],
      })).status,
    ).toBe(403);
    const sent = await editor.c.post(`${base}/comments/anchors`, {
      path: "book/index.md",
      oid,
      anchors: [{ threadId, from, to }],
    });
    expect(sent.status).toBe(200);
    expect((await threads())[0]).toMatchObject({ quote: "Energy is always conserved", outdated: false });

    // A rename takes the thread along.
    const files = (await editor.c.get(`${base}/files`)).body.files as { path: string; oid: string }[];
    await editor.c.post(`${base}/files/commit`, {
      changes: [{ op: "move", from: "book/index.md", to: "book/start.md", baseOid: files.find((f) => f.path === "book/index.md")!.oid }],
    });
    expect((await threads(editor, "book/start.md"))[0]).toMatchObject({ id: threadId, outdated: false });

    // Text deleted in the editor and saved: outdated for good.
    await editor.c.post(`${base}/comments/anchors`, {
      path: "book/start.md",
      oid,
      anchors: [{ threadId, from: null, to: null }],
    });
    expect((await threads())[0]).toMatchObject({ outdated: true });
  });

  it("carry suggestions that editors apply", async () => {
    const { commenter, editor, comment, threads, base } = await world();
    await comment(commenter, "times", "Use a symbol", { suggestion: "×" });
    const [thread] = await threads();
    const [first] = thread.comments;
    expect(first.suggestion).toBe("×");
    expect((await commenter.c.post(`${base}/comments/c/${first.id}/applied`)).status).toBe(403);
    expect((await editor.c.post(`${base}/comments/c/${first.id}/applied`)).status).toBe(200);
    expect((await threads())[0]).toMatchObject({ status: "resolved", comments: [{ appliedAt: expect.any(Number) }] });
    const plain = (await comment(commenter, "Energy", "No suggestion")).body.threadId;
    const plainComment = (await threads()).find((t: { id: number }) => t.id === plain).comments[0];
    expect((await editor.c.post(`${base}/comments/c/${plainComment.id}/applied`)).status).toBe(400);
  });
});

describe("comment emails", () => {
  it("go out as a digest to owners and editors, and replies to whoever took part", async () => {
    const { instance, commenter, editor, comment, base } = await world();
    const sent = instance.mailer.sent;
    sent.length = 0;
    const { threadId } = (await comment(commenter, "Energy", "Is this right?")).body;
    const t0 = Date.now();
    await sendCommentDigests(instance.db, instance.config, instance.mailer, t0);
    expect(sent.map((m) => m.to).sort()).toEqual(["e@example.org", "o@example.org"]);
    expect(sent[0]!.subject).toBe("New comment in “Physics”");
    expect(sent[0]!.text).toContain("Cem commented on book/index.md");
    expect(sent[0]!.text).toContain(`/books/${(await editor.c.get(base)).body.id}/edit?thread=${threadId}`);

    // The editor replies: the commenter, who started the thread, hears of it
    // at once; the owner took no part.
    sent.length = 0;
    await editor.c.post(`${base}/comments/${threadId}/replies`, { body: "Yes" });
    await sendCommentDigests(instance.db, instance.config, instance.mailer, t0 + 1000);
    expect(sent.map((m) => m.to)).toEqual(["c@example.org"]);

    // A second thread soon after waits for the owner's next digest.
    sent.length = 0;
    await comment(commenter, "Physics", "Title?");
    await comment(commenter, "mass", "Mass?");
    await sendCommentDigests(instance.db, instance.config, instance.mailer, t0 + 2000);
    expect(sent).toEqual([]);
    await sendCommentDigests(instance.db, instance.config, instance.mailer, t0 + DIGEST_INTERVAL_MS + 1);
    expect(sent.map((m) => m.to).sort()).toEqual(["e@example.org", "o@example.org"]);
    expect(sent[0]!.subject).toBe("2 new comments in “Physics”");
  });

  it("can be switched off per book, and link visitors get none", async () => {
    const { instance, owner, editor, comment, base } = await world();
    expect((await editor.c.get(base)).body.commentMail).toBe(true);
    expect((await editor.c.put(`${base}/comment-mail`, { commentMail: false })).body).toEqual({ commentMail: false });
    const sent = instance.mailer.sent;
    sent.length = 0;
    // A link visitor's thread: owners hear of it, the visitor has no address.
    const link = (await owner.c.post(`${base}/links`, { name: "Anna" })).body;
    const visitor = client(instance);
    await visitor.post("/api/links/redeem", { token: new URL(link.url).hash.slice(3) });
    const res = await comment({ c: visitor } as never, "Energy", "From Anna");
    expect(res.status).toBe(200);
    await sendCommentDigests(instance.db, instance.config, instance.mailer);
    expect(sent.map((m) => m.to)).toEqual(["o@example.org"]);
    expect(sent[0]!.text).toContain("Anna commented");
    expect((await visitor.get(base)).body.commentMail).toBeNull();
  });
});
