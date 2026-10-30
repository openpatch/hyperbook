import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BookTooLargeError,
  ChangeConflictError,
  checkout,
  commitChanges,
  commitTree,
  headCommit,
  initRepo,
  listTree,
  markProjectRoot,
  parseRefUpdates,
  readBlob,
} from "../src/server/hosting/git";

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cloud-git-"));
  dirs.push(dir);
  return dir;
}

const who = { name: "Ada", email: "ada@example.org" };
const options = { message: "Upload", author: who, committer: who };

async function tree(files: Record<string, string>) {
  const dir = path.join(await tmp(), "tree");
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  return dir;
}

describe("book repositories", () => {
  it("commits trees and checks them out again", async () => {
    const repo = path.join(await tmp(), "repo.git");
    await initRepo(repo);
    expect(await headCommit(repo)).toBeNull();

    const first = await commitTree(repo, await tree({ "a.md": "1", "sub/b.md": "2" }), options);
    expect(first.changed).toBe(true);
    expect(await headCommit(repo)).toBe(first.commit);

    // The same content again is not a new commit.
    const same = await commitTree(repo, await tree({ "a.md": "1", "sub/b.md": "2" }), options);
    expect(same).toEqual({ commit: first.commit, changed: false });

    // A new tree replaces the old one completely: b.md is gone.
    const second = await commitTree(repo, await tree({ "a.md": "changed" }), options);
    expect(second.changed).toBe(true);

    const out = path.join(await tmp(), "out");
    await mkdir(out);
    await checkout(repo, second.commit, out);
    expect(await readdir(out)).toEqual(["a.md"]);
    expect(await readFile(path.join(out, "a.md"), "utf8")).toBe("changed");

    const old = path.join(await tmp(), "old");
    await mkdir(old);
    await checkout(repo, first.commit, old);
    expect(await readFile(path.join(old, "sub", "b.md"), "utf8")).toBe("2");
  });

  it("honours the book's .gitignore", async () => {
    const repo = path.join(await tmp(), "repo.git");
    await initRepo(repo);
    const { commit } = await commitTree(
      repo,
      await tree({ ".gitignore": "secret.txt\n", "a.md": "1", "secret.txt": "x" }),
      options,
    );
    const out = path.join(await tmp(), "out");
    await mkdir(out);
    await checkout(repo, commit, out);
    expect((await readdir(out)).sort()).toEqual([".gitignore", "a.md"]);
  });

  it("marks a checkout as the book project root, for rfile and rbase64", async () => {
    const repo = path.join(await tmp(), "repo.git");
    await initRepo(repo);
    const { commit } = await commitTree(repo, await tree({ "book/a.md": "1", "LICENSE": "MIT" }), options);
    const out = path.join(await tmp(), "out");
    await mkdir(out);
    await checkout(repo, commit, out);
    expect((await readdir(out)).sort()).toEqual(["LICENSE", "book"]);

    // Hyperbook's rfile/rbase64 helpers find the nearest .git above the page
    // and read from its directory; the checkout has to be that root itself.
    await markProjectRoot(out);
    const dotGit = path.join(out, ".git");
    expect((await stat(dotGit)).isDirectory()).toBe(true);
    expect(await readFile(path.join(dotGit, "..", "LICENSE"), "utf8")).toBe("MIT");
  });
});

describe("changing files", () => {
  const opts = { ...options, message: "Edit", maxBytes: 1024 };
  const buf = (s: string) => Buffer.from(s);

  async function repoWith(files: Record<string, string>) {
    const repo = path.join(await tmp(), "repo.git");
    await initRepo(repo);
    await commitTree(repo, await tree(files), options);
    const entries = await listTree(repo, (await headCommit(repo))!);
    return { repo, oid: (p: string) => entries.find((e) => e.path === p)!.oid };
  }

  async function contents(repo: string) {
    const entries = await listTree(repo, (await headCommit(repo))!);
    const out: Record<string, string> = {};
    for (const e of entries) out[e.path] = (await readBlob(repo, e.oid)).toString();
    return out;
  }

  it("lists, writes, deletes and moves files in one commit", async () => {
    const { repo, oid } = await repoWith({ "a.md": "1", "sub/b.md": "2", "c.md": "3" });
    const res = await commitChanges(
      repo,
      [
        { op: "write", path: "a.md", content: buf("one"), baseOid: oid("a.md") },
        { op: "write", path: "new/d.md", content: buf("4"), baseOid: null },
        { op: "delete", path: "c.md", baseOid: oid("c.md") },
        { op: "move", from: "sub/b.md", to: "e.md", baseOid: oid("sub/b.md") },
      ],
      opts,
    );
    expect(res.changed).toBe(true);
    expect(await contents(repo)).toEqual({ "a.md": "one", "new/d.md": "4", "e.md": "2" });
  });

  it("starts an empty repository", async () => {
    const repo = path.join(await tmp(), "repo.git");
    await initRepo(repo);
    await commitChanges(repo, [{ op: "write", path: "hyperbook.json", content: buf("{}"), baseOid: null }], opts);
    expect(await contents(repo)).toEqual({ "hyperbook.json": "{}" });
  });

  it("refuses changes made against an older version", async () => {
    const { repo, oid } = await repoWith({ "a.md": "1", "b.md": "2" });
    const base = oid("a.md");
    await commitChanges(repo, [{ op: "write", path: "a.md", content: buf("theirs"), baseOid: base }], opts);
    const before = await headCommit(repo);
    const attempt = commitChanges(
      repo,
      [
        { op: "write", path: "b.md", content: buf("fine"), baseOid: oid("b.md") },
        { op: "write", path: "a.md", content: buf("mine"), baseOid: base },
      ],
      opts,
    );
    await expect(attempt).rejects.toBeInstanceOf(ChangeConflictError);
    await expect(attempt).rejects.toMatchObject({ paths: ["a.md"] });
    expect(await headCommit(repo)).toBe(before);
    // A new file where one appeared in the meantime is a conflict, too.
    await expect(
      commitChanges(repo, [{ op: "write", path: "b.md", content: buf("x"), baseOid: null }], opts),
    ).rejects.toBeInstanceOf(ChangeConflictError);
  });

  it("keeps saves of other files made at the same time", async () => {
    const { repo, oid } = await repoWith({ "a.md": "1", "b.md": "2" });
    await Promise.all([
      commitChanges(repo, [{ op: "write", path: "a.md", content: buf("A"), baseOid: oid("a.md") }], opts),
      commitChanges(repo, [{ op: "write", path: "b.md", content: buf("B"), baseOid: oid("b.md") }], opts),
    ]);
    expect(await contents(repo)).toEqual({ "a.md": "A", "b.md": "B" });
  });

  it("refuses a file and a folder of the same name, and books over the limit", async () => {
    const { repo } = await repoWith({ "sub/a.md": "1" });
    await expect(
      commitChanges(repo, [{ op: "write", path: "sub", content: buf("x"), baseOid: null }], opts),
    ).rejects.toBeInstanceOf(ChangeConflictError);
    await expect(
      commitChanges(repo, [{ op: "write", path: "big", content: Buffer.alloc(2048), baseOid: null }], opts),
    ).rejects.toBeInstanceOf(BookTooLargeError);
  });

  it("does not make a commit when nothing changes", async () => {
    const { repo, oid } = await repoWith({ "a.md": "1" });
    const before = await headCommit(repo);
    const res = await commitChanges(repo, [{ op: "write", path: "a.md", content: buf("1"), baseOid: oid("a.md") }], opts);
    expect(res).toEqual({ commit: before, changed: false });
  });
});

describe("parseRefUpdates", () => {
  it("reads the ref-update pkt-lines and ignores the pack data", () => {
    const line1 = "1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 refs/heads/main\0capabilities";
    const line2 = "0000000000000000000000000000000000000000 3333333333333333333333333333333333333333 refs/tags/v1";
    const pkt = (s: string) => (s.length + 4).toString(16).padStart(4, "0") + s;
    const body = Buffer.concat([
      Buffer.from(pkt(line1) + pkt(line2) + "0000"),
      Buffer.from([0x50, 0x41, 0x43, 0x4b, 0x00, 0x01]), // pack data follows
    ]);
    expect(parseRefUpdates(body)).toEqual([
      { old: "1".repeat(40), new: "2".repeat(40), ref: "refs/heads/main" },
      { old: "0".repeat(40), new: "3".repeat(40), ref: "refs/tags/v1" },
    ]);
    expect(parseRefUpdates(Buffer.from("0000"))).toEqual([]);
    expect(parseRefUpdates(Buffer.alloc(0))).toEqual([]);
  });
});
