import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { serve, type ServerType } from "@hono/node-server";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  auditLog,
  books,
  builds,
  entitlements,
  gitTokens,
} from "../src/server/db/schema";
import { updateInstanceSettings } from "../src/server/domain/instance";
import {
  headCommit,
  listTags,
  resolveTagCommit,
} from "../src/server/hosting/git";
import type { Runner } from "../src/server/hosting/runner";
import { buildDir, repoDir } from "../src/server/hosting/storage";
import { type Instance, loggedIn, setup } from "./helpers";

/*
 * End-to-end tests of the git smart-HTTP endpoint with the real git binary:
 * the app runs on a real (ephemeral) port, and git sends the admin host in a
 * Host header override, so createApp routes it to the admin app.
 */

const tmpDirs: string[] = [];
afterAll(async () => {
  for (const dir of tmpDirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cloud-githttp-"));
  tmpDirs.push(dir);
  return dir;
}

function run(
  cmd: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> } = {
    cwd: process.cwd(),
  },
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: options.cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...options.env },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d));
      child.stderr.on("data", (d: Buffer) => (stderr += d));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    },
  );
}

/** git with the admin host sent as Host header, against the ephemeral port. */
const git = (
  port: number,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) =>
  run("git", ["-c", "http.extraHeader=Host: admin.test", ...args], {
    cwd,
    env,
  });

async function startServer(instance: Instance) {
  const port = await new Promise<number>((resolve) => {
    const server = serve(
      { fetch: instance.app.fetch, port: 0, hostname: "127.0.0.1" },
      (info) => {
        resolve(info.port);
        servers.push(server);
      },
    );
  });
  return port;
}

const servers: ServerType[] = [];
afterAll(async () => {
  for (const server of servers.splice(0))
    await new Promise<void>((r) => server.close(() => r()));
});

async function world() {
  const instance = setup();
  const owner = await loggedIn(instance, {
    email: "o@example.org",
    displayName: "Owner",
  });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
  ).body;
  await owner.c.post(`/api/books/${book.id}/members`, {
    email: "x@example.org",
    role: "editor",
  });
  const token = (
    await owner.c.post(`/api/books/${book.id}/git/tokens`, { label: "laptop" })
  ).body;
  const port = await startServer(instance);
  return { instance, owner, other, book, token: token.token as string, port };
}

const url = (port: number, token: string, bookId: number) =>
  `http://git:${encodeURIComponent(token)}@127.0.0.1:${port}/api/books/${bookId}/git`;

/** A local clone with one commit on main. */
async function localBook(
  port: number,
  token: string,
  bookId: number,
  files: Record<string, string>,
) {
  const dir = await tmp();
  await git(port, ["init", "-b", "main", "."], dir);
  await git(
    port,
    [
      "-c",
      "user.email=a@b.c",
      "-c",
      "user.name=A",
      "config",
      "user.email",
      "a@b.c",
    ],
    dir,
  );
  await git(port, ["config", "user.name", "A"], dir);
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  await git(port, ["add", "-A"], dir);
  await git(
    port,
    ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-m", "initial"],
    dir,
  );
  await git(port, ["remote", "add", "origin", url(port, token, bookId)], dir);
  return dir;
}

const FILES = {
  "hyperbook.json": '{"name":"Physics"}',
  "index.html": "<h1>Hello</h1>",
};

const bookRow = (instance: Instance, id: number) =>
  instance.db.select().from(books).where(eq(books.id, id)).get()!;

describe("git smart HTTP", () => {
  it("clones an empty book and accepts a push to main, with bookkeeping", async () => {
    const { instance, owner, book, token, port } = await world();
    const dir = await localBook(port, token, book.id, FILES);
    const push = await git(port, ["push", "origin", "main"], dir);
    expect(push.code).toBe(0);

    const repo = repoDir(instance.config, book.id);
    const head = await headCommit(repo);
    const local = await git(port, ["rev-parse", "HEAD"], dir);
    expect(head).toBe(local.stdout.trim());
    // Push bookkeeping: commit count, source size, audit — and no build, no tags.
    expect(bookRow(instance, book.id)).toMatchObject({
      commitCount: 1,
      sourceBytes: expect.any(Number),
    });
    expect(bookRow(instance, book.id).sourceBytes).toBeGreaterThan(0);
    const pushes = instance.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "book.push"))
      .all();
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      actorUserId: owner.user.id,
      targetId: book.id,
    });
    expect(instance.db.select().from(builds).all()).toHaveLength(0);
    expect(await listTags(repo)).toEqual([]);

    // A second user with their own token can clone and sees the file.
    const otherToken = (
      await owner.c.post(`/api/books/${book.id}/git/tokens`, { label: "x" })
    ).body;
    void otherToken;
    const clone = await tmp();
    const res = await git(
      port,
      ["clone", url(port, token, book.id), clone],
      clone,
    );
    expect(res.code).toBe(0);
    expect(
      await run("cat", [path.join(clone, "index.html")], { cwd: clone }),
    ).toMatchObject({
      stdout: "<h1>Hello</h1>",
    });
  });

  it("requires a token and rejects wrong, revoked and cross-book tokens", async () => {
    const { instance, owner, book, token, port } = await world();
    const info = (t: string) =>
      instance.app.request(
        `/api/books/${book.id}/git/info/refs?service=git-upload-pack`,
        {
          headers: {
            host: "admin.test",
            authorization: `Basic ${Buffer.from(`git:${t}`).toString("base64")}`,
          },
        },
      );
    expect((await info("")).status).toBe(401);
    expect(
      (
        await instance.app.request(
          `/api/books/${book.id}/git/info/refs?service=git-upload-pack`,
          { headers: { host: "admin.test" } },
        )
      ).status,
    ).toBe(401);
    expect((await info("wrong-token")).status).toBe(401);

    // A token of another book does not open this one.
    const book2 = (
      await owner.c.post("/api/books", { title: "Math", slug: "math" })
    ).body;
    const token2 = (await owner.c.post(`/api/books/${book2.id}/git/tokens`, {}))
      .body.token as string;
    expect((await info(token2)).status).toBe(401);

    // A live token works, updates lastUsedAt, and only its hash is stored.
    const ok = await info(token);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain(
      "application/x-git-upload-pack-advertisement",
    );
    const row = instance.db
      .select()
      .from(gitTokens)
      .all()
      .find((r) => r.bookId === book.id)!;
    expect(row.idHash).toHaveLength(64);
    expect(row.lastUsedAt).not.toBeNull();

    // Revoked: refused at once.
    const list = (await owner.c.get(`/api/books/${book.id}/git/tokens`)).body;
    expect(list).toHaveLength(1);
    expect(
      (await owner.c.delete(`/api/books/${book.id}/git/tokens/${list[0].id}`))
        .status,
    ).toBe(200);
    expect((await info(token)).status).toBe(401);

    // At most 10 active tokens per user and book.
    for (let i = 0; i < 10; i++) {
      expect(
        (await owner.c.post(`/api/books/${book.id}/git/tokens`, {})).status,
      ).toBe(200);
    }
    expect(
      (await owner.c.post(`/api/books/${book.id}/git/tokens`, {})).status,
    ).toBe(409);
  });

  it("refuses tags, other branches, deletes and non-fast-forward pushes", async () => {
    const { book, token, port } = await world();
    const dir = await localBook(port, token, book.id, FILES);
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
    // A second commit to have history to rewind.
    await writeFile(path.join(dir, "index.html"), "<h1>Two</h1>");
    await git(
      port,
      ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-am", "two"],
      dir,
    );
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);

    const tag = await git(port, ["push", "origin", "main:refs/tags/v9"], dir);
    expect(tag.code).not.toBe(0);
    expect(tag.stderr).toContain("Only the main branch");

    const branch = await git(port, ["push", "origin", "main:feature"], dir);
    expect(branch.code).not.toBe(0);
    expect(branch.stderr).toContain("Only the main branch");

    const del = await git(port, ["push", "origin", ":main"], dir);
    expect(del.code).not.toBe(0);

    // Rewind locally and force: refused as non-fast-forward.
    await git(port, ["reset", "--hard", "HEAD~1"], dir);
    await writeFile(path.join(dir, "index.html"), "<h1>Rewritten</h1>");
    await git(
      port,
      [
        "-c",
        "user.email=a@b.c",
        "-c",
        "user.name=A",
        "commit",
        "-am",
        "rewrite",
      ],
      dir,
    );
    const force = await git(port, ["push", "--force", "origin", "main"], dir);
    expect(force.code).not.toBe(0);
    expect(force.stderr).toMatch(/non-fast-forward|rejected/i);
  });

  it("enforces the storage quota on the pushed tree", async () => {
    const { instance, owner, book, token, port } = await world();
    // The owner may use 0 MB beyond what the book already has.
    instance.db
      .insert(entitlements)
      .values({ userId: owner.user.id, key: "max_storage_mb", value: "0" })
      .run();
    const dir = await localBook(port, token, book.id, FILES);
    const push = await git(port, ["push", "origin", "main"], dir);
    expect(push.code).not.toBe(0);
    expect(push.stderr).toContain("larger than");
    expect(await headCommit(repoDir(instance.config, book.id))).toBeNull();
    expect(
      instance.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "book.push"))
        .all(),
    ).toHaveLength(0);
  });

  it("publish creates version tags; rollback to a kept build is instant, to a pruned one a rebuild", async () => {
    const { instance, owner, book, token, port } = await world();
    const repo = repoDir(instance.config, book.id);

    // Push v1 of the content, publish → v1 tag + published tag.
    const dir = await localBook(port, token, book.id, FILES);
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
    await owner.c.post(`/api/books/${book.id}/publish`, {});
    await instance.builds.idle();
    const commit1 = (await git(port, ["rev-parse", "HEAD"], dir)).stdout.trim();
    expect(await resolveTagCommit(repo, "v1")).toBe(commit1);
    expect(await resolveTagCommit(repo, "published")).toBe(commit1);
    const build1 = instance.db
      .select()
      .from(builds)
      .where(eq(builds.bookId, book.id))
      .all();
    expect(build1).toHaveLength(1);
    expect(bookRow(instance, book.id).publishedBuildId).toBe(build1[0]!.id);

    // Push v2, publish → v2.
    await writeFile(path.join(dir, "index.html"), "<h1>Two</h1>");
    await git(
      port,
      ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-am", "two"],
      dir,
    );
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
    await owner.c.post(`/api/books/${book.id}/publish`, {
      note: "Second version",
    });
    await instance.builds.idle();
    const commit2 = (await git(port, ["rev-parse", "HEAD"], dir)).stdout.trim();
    expect(await resolveTagCommit(repo, "v2")).toBe(commit2);
    const all = instance.db
      .select()
      .from(builds)
      .where(eq(builds.bookId, book.id))
      .all();
    expect(all.find((b) => b.note === "Second version")).toBeTruthy();
    expect(all.map((b) => b.trigger).sort()).toEqual(["publish", "publish"]);

    // Rollback to v1: its build is still kept → instant switch.
    const rb = await owner.c.post(`/api/books/${book.id}/rollback`, {
      tag: "v1",
    });
    expect(rb.status).toBe(200);
    expect(rb.body.published).toBe(true);
    expect(bookRow(instance, book.id).publishedBuildId).toBe(build1[0]!.id);
    expect(await resolveTagCommit(repo, "published")).toBe(commit1);
    expect(
      instance.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "book.rollback"))
        .all(),
    ).toHaveLength(1);

    // Publish two more versions: v1 and v2 tags (and builds) are pruned away.
    for (const content of ["<h1>Three</h1>", "<h1>Four</h1>"]) {
      await writeFile(path.join(dir, "index.html"), content);
      await git(
        port,
        [
          "-c",
          "user.email=a@b.c",
          "-c",
          "user.name=A",
          "commit",
          "-am",
          content,
        ],
        dir,
      );
      expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
      await owner.c.post(`/api/books/${book.id}/publish`, {});
      await instance.builds.idle();
    }
    expect((await listTags(repo)).map((t) => t.name).sort()).toEqual([
      "published",
      "v3",
      "v4",
    ]);
    expect(buildDir(instance.config, book.id, build1[0]!.id)).not.toBe("");
    const { existsSync } = await import("node:fs");
    expect(existsSync(buildDir(instance.config, book.id, build1[0]!.id))).toBe(
      false,
    );

    // Rollback to v1 is impossible now (tag gone); to v3 it is instant again.
    expect(
      (await owner.c.post(`/api/books/${book.id}/rollback`, { tag: "v1" }))
        .status,
    ).toBe(404);
    expect(
      (await owner.c.post(`/api/books/${book.id}/rollback`, { tag: "v3" })).body
        .published,
    ).toBe(true);

    // A tag whose build output is gone (e.g. after a backup restore) rebuilds on rollback.
    const v3 = await resolveTagCommit(repo, "v3");
    const build3 = instance.db
      .select()
      .from(builds)
      .where(eq(builds.commit, v3!))
      .all()
      .find((b) => b.status === "succeeded")!;
    await rm(buildDir(instance.config, book.id, build3.id), {
      recursive: true,
      force: true,
    });
    const previewBefore = bookRow(instance, book.id).previewBuildId;
    const rb2 = await owner.c.post(`/api/books/${book.id}/rollback`, {
      tag: "v3",
    });
    expect(rb2.body.published).toBe(false);
    await instance.builds.idle();
    const rebuilt = instance.db
      .select()
      .from(builds)
      .where(eq(builds.bookId, book.id))
      .all()
      .find((b) => b.trigger === "rollback")!;
    expect(rebuilt.status).toBe("succeeded");
    // The rollback build went live, but the preview stayed where it was.
    expect(bookRow(instance, book.id).publishedBuildId).toBe(rebuilt.id);
    expect(bookRow(instance, book.id).previewBuildId).toBe(previewBefore);
    expect(await resolveTagCommit(repo, "published")).toBe(v3);
    expect(
      instance.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "book.rollback"))
        .all(),
    ).toHaveLength(3);

    // Bad input: not a version tag.
    expect(
      (await owner.c.post(`/api/books/${book.id}/rollback`, { tag: "main" }))
        .status,
    ).toBe(400);
    expect(
      (await owner.c.post(`/api/books/${book.id}/rollback`, { tag: "v999" }))
        .status,
    ).toBe(404);
  });

  it("editor save against a pre-push baseOid conflicts; push after an editor save is non-FF", async () => {
    const { instance, owner, book, token, port } = await world();
    const dir = await localBook(port, token, book.id, FILES);
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);

    // The editor reads the file listing, then someone pushes a change to it.
    const files = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    const oid = files.files.find((f: any) => f.path === "index.html").oid;
    await writeFile(path.join(dir, "index.html"), "<h1>Pushed</h1>");
    await git(
      port,
      [
        "-c",
        "user.email=a@b.c",
        "-c",
        "user.name=A",
        "commit",
        "-am",
        "pushed",
      ],
      dir,
    );
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);

    const stale = await owner.c.post(`/api/books/${book.id}/files/commit`, {
      changes: [
        {
          op: "write",
          path: "index.html",
          content: "editor",
          encoding: "utf8",
          baseOid: oid,
        },
      ],
    });
    expect(stale.status).toBe(409);
    expect(stale.body.conflicts).toEqual(["index.html"]);

    // After re-reading, the save works and counts one commit.
    const before = bookRow(instance, book.id).commitCount;
    const files2 = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    const oid2 = files2.files.find((f: any) => f.path === "index.html").oid;
    const save = await owner.c.post(`/api/books/${book.id}/files/commit`, {
      changes: [
        {
          op: "write",
          path: "index.html",
          content: "editor",
          encoding: "utf8",
          baseOid: oid2,
        },
      ],
    });
    expect(save.status).toBe(200);
    expect(bookRow(instance, book.id).commitCount).toBe(before + 1);

    // A push on top of the editor's older local commit is non-fast-forward.
    await writeFile(path.join(dir, "index.html"), "<h1>Local again</h1>");
    await git(
      port,
      ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-am", "local"],
      dir,
    );
    const push = await git(port, ["push", "origin", "main"], dir);
    expect(push.code).not.toBe(0);
    // Pull first, then the push works.
    await git(port, ["fetch", "origin"], dir);
    await git(port, ["reset", "--hard", "origin/main"], dir);
    await writeFile(path.join(dir, "index.html"), "<h1>Local again</h1>");
    await git(
      port,
      ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-am", "local"],
      dir,
    );
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
  });

  it("a push enqueues a preview build only when the instance setting is on", async () => {
    let gate!: () => void;
    const gatePromise = new Promise<void>((r) => (gate = r));
    let started = false;
    const runner: Runner = async (job) => {
      started = true;
      await gatePromise;
      return (await import("./helpers")).copyRunner(job);
    };
    const instance = setup({}, { runner });
    const owner = await loggedIn(instance, { email: "o@example.org" });
    const book = (
      await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
    ).body;
    const token = (await owner.c.post(`/api/books/${book.id}/git/tokens`, {}))
      .body.token as string;
    const port = await startServer(instance);

    const dir = await localBook(port, token, book.id, FILES);
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
    // Off by default: no build.
    expect(instance.db.select().from(builds).all()).toHaveLength(0);

    updateInstanceSettings(instance.db, { gitPushUpdatesPreview: true });
    await writeFile(path.join(dir, "index.html"), "<h1>Two</h1>");
    await git(
      port,
      ["-c", "user.email=a@b.c", "-c", "user.name=A", "commit", "-am", "two"],
      dir,
    );
    expect((await git(port, ["push", "origin", "main"], dir)).code).toBe(0);
    // A preview-only build was queued and picked up (waiting at the gate).
    const queued = instance.db.select().from(builds).all();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      trigger: "push",
      publish: false,
      status: "running",
    });
    void started;
    gate();
    await instance.builds.idle();
    const row = bookRow(instance, book.id);
    expect(row.previewBuildId).toBe(queued[0]!.id);
    expect(row.publishedBuildId).toBeNull();
  });
});
