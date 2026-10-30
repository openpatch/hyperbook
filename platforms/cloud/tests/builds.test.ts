import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { books, builds } from "../src/server/db/schema";
import { updateInstanceSettings } from "../src/server/domain/instance";
import { sharedAssetsBaseFor } from "../src/server/hosting/runtimes";
import { commitTree, initRepo, listTags } from "../src/server/hosting/git";
import { BuildLog, type Runner, hyperbookVersion, sandboxedRunner } from "../src/server/hosting/runner";
import { buildDir, makeJobDir, repoDir } from "../src/server/hosting/storage";
import { type Instance, copyRunner, setup } from "./helpers";

const who = { name: "Ada", email: "ada@example.org" };

async function bookWithSource(instance: Instance, files: Record<string, string>) {
  const book = instance.db
    .insert(books)
    .values({ slug: `b${Math.random().toString(36).slice(2, 8)}`, title: "Book" })
    .returning()
    .get();
  const commit = await commitFiles(instance, book.id, files);
  return { book, commit };
}

async function commitFiles(instance: Instance, bookId: number, files: Record<string, string>) {
  const repo = repoDir(instance.config, bookId);
  await initRepo(repo);
  const dir = await makeJobDir(instance.config, "test");
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  const { commit } = await commitTree(repo, dir, { message: "Upload", author: who, committer: who });
  return commit;
}

function bookRow(instance: Instance, id: number) {
  return instance.db.select().from(books).where(eq(books.id, id)).get()!;
}

function buildRow(instance: Instance, id: number) {
  return instance.db.select().from(builds).where(eq(builds.id, id)).get()!;
}

describe("build queue", () => {
  it("builds a commit and publishes it", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}", "index.html": "hi" });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();

    expect(buildRow(instance, build.id)).toMatchObject({ status: "succeeded", error: null });
    expect(bookRow(instance, book.id).publishedBuildId).toBe(build.id);
    const out = buildDir(instance.config, book.id, build.id);
    expect(await readFile(path.join(out, "index.html"), "utf8")).toBe("hi");
    // The job directory is gone.
    const tmp = await readdir(path.join(instance.config.dataDir, "tmp"));
    expect(tmp.filter((d) => d.startsWith("build-"))).toEqual([]);
  });

  it("keeps the published build when a new one fails", async () => {
    let fail = false;
    const runner: Runner = async (job) => (fail ? { ok: false, error: "broken" } : copyRunner(job));
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const good = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();

    fail = true;
    const bad = instance.builds.enqueue(book.id, commit, "rebuild", null);
    await instance.builds.idle();
    expect(buildRow(instance, bad.id)).toMatchObject({ status: "failed", error: "broken" });
    expect(buildRow(instance, bad.id).log).toContain("broken");
    expect(bookRow(instance, book.id).publishedBuildId).toBe(good.id);
  });

  it("keeps a successfully published build successful when tag updates fail", async () => {
    let bookId = 0;
    const runner: Runner = async (job) => {
      const result = await copyRunner(job);
      const tagsDir = path.join(repoDir(job.config, bookId), "refs", "tags");
      await rm(tagsDir, { recursive: true, force: true });
      await writeFile(tagsDir, "unavailable");
      return result;
    };
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    bookId = book.id;

    const build = instance.builds.enqueue(book.id, commit, "publish", null);
    await instance.builds.idle();

    expect(buildRow(instance, build.id)).toMatchObject({
      status: "succeeded",
      error: null,
    });
    expect(buildRow(instance, build.id).log).toContain(
      "git tags could not be updated",
    );
    expect(bookRow(instance, book.id).publishedBuildId).toBe(build.id);
  });

  it("replaces a queued build of the same book", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const runner: Runner = async (job) => {
      await gate;
      return copyRunner(job);
    };
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const first = instance.builds.enqueue(book.id, commit, "upload", null); // starts running
    const second = instance.builds.enqueue(book.id, commit, "rebuild", null); // waits
    const third = instance.builds.enqueue(book.id, commit, "rebuild", null); // replaces second
    release();
    await instance.builds.idle();
    expect(buildRow(instance, first.id).status).toBe("succeeded");
    expect(buildRow(instance, second.id).status).toBe("canceled");
    expect(buildRow(instance, third.id).status).toBe("succeeded");
    expect(bookRow(instance, book.id).publishedBuildId).toBe(third.id);
  });

  it("builds after a save only update the preview", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const live = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const edit = instance.builds.enqueue(book.id, commit, "edit", null);
    await instance.builds.idle();
    expect(buildRow(instance, edit.id)).toMatchObject({ status: "succeeded", publish: false });
    expect(bookRow(instance, book.id)).toMatchObject({ publishedBuildId: live.id, previewBuildId: edit.id });
  });

  it("never lets a preview build replace one that is to go live", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const runner: Runner = async (job) => {
      await gate;
      return copyRunner(job);
    };
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    instance.builds.enqueue(book.id, commit, "edit", null); // starts running
    const publish = instance.builds.enqueue(book.id, commit, "publish", null);
    const edit1 = instance.builds.enqueue(book.id, commit, "edit", null);
    const edit2 = instance.builds.enqueue(book.id, commit, "edit", null); // replaces edit1 only
    release();
    await instance.builds.idle();
    expect(buildRow(instance, publish.id).status).toBe("succeeded");
    expect(buildRow(instance, edit1.id).status).toBe("canceled");
    expect(bookRow(instance, book.id)).toMatchObject({ publishedBuildId: publish.id, previewBuildId: edit2.id });
  });

  it("lets a running preview build of the same commit go live instead of building it again", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const runner: Runner = async (job) => {
      await gate;
      return copyRunner(job);
    };
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const edit = instance.builds.enqueue(book.id, commit, "edit", null); // starts running
    const other = await commitFiles(instance, book.id, { "hyperbook.json": '{"name":"x"}' });
    expect(instance.builds.publishPending(book.id, other, null)).toBeNull();
    expect(instance.builds.publishPending(book.id, commit, null)).toMatchObject({ id: edit.id, publish: true, trigger: "publish" });
    release();
    await instance.builds.idle();
    expect(buildRow(instance, edit.id)).toMatchObject({ status: "succeeded", publish: true });
    expect(buildRow(instance, edit.id).log).toContain("Published");
    expect(bookRow(instance, book.id)).toMatchObject({ publishedBuildId: edit.id, previewBuildId: edit.id });
  });

  it("reports how far a running build is", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let started!: () => void;
    const running = new Promise<void>((r) => (started = r));
    const runner: Runner = async (job) => {
      job.log.write("[Book] Building book: [1/10]\x1b[2K\x1b[1G[Book] Building book: [3/10]");
      started();
      await gate;
      return copyRunner(job);
    };
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    expect(instance.builds.progress(build.id)).toBeNull();
    await running;
    expect(instance.builds.progress(build.id)).toEqual({ step: "book", done: 3, total: 10 });
    release();
    await instance.builds.idle();
    expect(instance.builds.progress(build.id)).toBeNull();
  });

  it("cancels a running build", async () => {
    const runner: Runner = ({ signal }) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve({ ok: false, error: "The build was canceled" })),
      );
    const instance = setup({}, { runner });
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    // Right away, while the source is still being checked out.
    expect(instance.builds.cancel(build.id)).toBe(true);
    await instance.builds.idle();
    expect(buildRow(instance, build.id).status).toBe("canceled");
    expect(bookRow(instance, book.id).publishedBuildId).toBeNull();
  });

  it("deletes old build output but keeps the preview and two previous builds when there are no tags", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(instance.builds.enqueue(book.id, commit, "edit", null).id);
      await instance.builds.idle();
    }
    const kept = ids.filter((id) => existsSync(buildDir(instance.config, book.id, id)));
    expect(kept).toEqual(ids.slice(2));
  });

  it("keeps the builds of the kept version tags (published + last two v-tags)", async () => {
    const instance = setup();
    const { book } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const ids: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const commit = await commitFiles(instance, book.id, { "hyperbook.json": "{}", "index.html": `v${i}` });
      ids.push(instance.builds.enqueue(book.id, commit, "publish", null).id);
      await instance.builds.idle();
    }
    // Tags v1..v4 were created and pruned to v3, v4; their builds stay.
    const tags = await listTags(repoDir(instance.config, book.id));
    expect(tags.map((t) => t.name).sort()).toEqual(["published", "v3", "v4"]);
    const kept = ids.filter((id) => existsSync(buildDir(instance.config, book.id, id)));
    expect(kept).toEqual([ids[2]!, ids[3]!]);
  });

  it("keeps the preview build as well", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const live = instance.builds.enqueue(book.id, commit, "upload", null).id;
    await instance.builds.idle();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(instance.builds.enqueue(book.id, commit, "edit", null).id);
      await instance.builds.idle();
    }
    // The upload's tag points at the same commit; its newest build is kept, and so are the published and preview builds.
    const kept = [live, ...ids].filter((id) => existsSync(buildDir(instance.config, book.id, id)));
    expect(kept).toEqual([live, ids[3]!]);
  });

  it("marks builds interrupted by a restart as failed", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const row = instance.db
      .insert(builds)
      .values({ bookId: book.id, commit, trigger: "upload", status: "running" })
      .returning()
      .get();
    instance.builds.start();
    expect(buildRow(instance, row.id)).toMatchObject({ status: "failed" });
  });
});

describe.skipIf(!hyperbookVersion(setup().config))("rebuilds after an update of Hyperbook", () => {
  /** A book published with an older Hyperbook. */
  async function oldBook(instance: Instance) {
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}" });
    const old = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    instance.db.update(builds).set({ hyperbookVersion: "0.0.1" }).where(eq(builds.id, old.id)).run();
    return { book, old };
  }

  it("rebuilds published books made with another version, once", async () => {
    const instance = setup();
    const { book, old } = await oldBook(instance);
    expect(instance.builds.enqueueRebuilds({ upgrades: true })).toBe(1);
    await instance.builds.idle();
    const now = bookRow(instance, book.id);
    expect(now.publishedBuildId).not.toBe(old.id);
    expect(buildRow(instance, now.publishedBuildId!)).toMatchObject({ trigger: "upgrade", replacesBuildId: old.id });
    expect(now.previewBuildId).toBe(now.publishedBuildId);
    // Up to date now.
    expect(instance.builds.enqueueRebuilds({ upgrades: true })).toBe(0);
  });

  it("rebuilds books whose build is gone, as after restoring a backup", async () => {
    const instance = setup();
    const { book, commit } = await bookWithSource(instance, { "hyperbook.json": "{}", "index.html": "hi" });
    const live = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const { rmSync } = await import("node:fs");
    rmSync(buildDir(instance.config, book.id, live.id), { recursive: true });
    expect(instance.builds.enqueueRebuilds({ upgrades: false })).toBe(1);
    await instance.builds.idle();
    const now = bookRow(instance, book.id).publishedBuildId!;
    expect(now).not.toBe(live.id);
    expect(existsSync(buildDir(instance.config, book.id, now))).toBe(true);
  });

  it("leaves a book alone that was published again in the meantime", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let hold = false;
    const runner: Runner = async (job) => {
      if (hold) await gate;
      return copyRunner(job);
    };
    const instance = setup({}, { runner });
    const { book, old } = await oldBook(instance);
    hold = true;
    instance.builds.enqueueRebuilds({ upgrades: true }); // starts and waits at the gate
    // Meanwhile another build goes live (a rollback, say).
    const other = instance.db
      .insert(builds)
      .values({ bookId: book.id, commit: old.commit, trigger: "rebuild", status: "succeeded" })
      .returning()
      .get();
    instance.db.update(books).set({ publishedBuildId: other.id, previewBuildId: other.id }).where(eq(books.id, book.id)).run();
    release();
    await instance.builds.idle();
    expect(bookRow(instance, book.id)).toMatchObject({ publishedBuildId: other.id, previewBuildId: other.id });
  });
});

describe("build log", () => {
  it("collapses progress lines and strips colors", () => {
    const log = new BuildLog();
    log.write("\x1b[34m[Book]\x1b[39m start\n");
    log.write("\x1b[2K\x1b[1G[Book] page [1/3]\x1b[2K\x1b[1G[Book] page [2/3]");
    log.write("\x1b[2K\x1b[1G[Book] page [3/3]\n");
    log.write("done\r\n");
    log.write("\x1b[2K\x1b[1G\n");
    expect(log.toString()).toBe("[Book] start\n[Book] page [3/3]\ndone");
  });

  it("hides redacted paths", () => {
    const log = new BuildLog();
    log.redact("/data/tmp/build-1/src", "<book>");
    log.write("Build success: /data/tmp/build-1/src/.hyperbook/out\n");
    expect(log.toString()).toBe("Build success: <book>/.hyperbook/out");
  });
});

const cliBuilt = existsSync(setup().config.build.cli);

describe.skipIf(!cliBuilt)("sandboxed hyperbook build", () => {
  it("builds a real book without access to anything else", async () => {
    const instance = setup({}, { runner: sandboxedRunner });
    const { book, commit } = await bookWithSource(instance, {
      "hyperbook.json": JSON.stringify({ name: "Sandbox", basePath: "/sub" }),
      "book/index.md": "# Hello from the sandbox\n",
    });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const row = buildRow(instance, build.id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("succeeded");
    expect(row.log).toContain('Ignoring "basePath"');
    expect(row.log).toContain("<book>/.hyperbook/out");
    expect(row.log).not.toContain(instance.config.dataDir);
    expect(row.hyperbookVersion).toMatch(/^\d+\.\d+\.\d+/);
    const html = await readFile(path.join(buildDir(instance.config, book.id, build.id), "index.html"), "utf8");
    expect(html).toContain("Hello from the sandbox");
    // basePath was dropped: assets are linked from the root.
    expect(html).not.toContain("/sub/__hyperbook_assets");
    // Students log in to the platform, on the book's own host.
    expect(html).toContain('HYPERBOOK_CLOUD = {"sameOrigin":true}');
    expect(html).toContain("cloud.js");
  }, 60_000);

  it("links elements to the instance's shared runtimes instead of copying them", async () => {
    const instance = setup({}, { runner: sandboxedRunner });
    const { book, commit } = await bookWithSource(instance, {
      "hyperbook.json": JSON.stringify({ name: "Drawing" }),
      "book/index.md": '# Drawing\n\n::excalidraw{src="/drawing.excalidraw"}\n',
      "public/drawing.excalidraw": JSON.stringify({ type: "excalidraw", version: 2, elements: [] }),
    });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const row = buildRow(instance, build.id);
    expect(row.error, row.log).toBeNull();
    expect(row.log).toContain("Element runtimes are served by this instance");
    const out = buildDir(instance.config, book.id, build.id);

    const base = sharedAssetsBaseFor(instance.config)!;
    expect(base).toMatch(/^\/_hyperbook\/assets\/\d+\.\d+\.\d+\/$/);
    const html = await readFile(path.join(out, "index.html"), "utf8");
    expect(html).toContain(`${base}directive-excalidraw/hyperbook-excalidraw.umd.js`);
    // The build contains only the small integration files, not the runtime.
    expect(existsSync(path.join(out, "__hyperbook_assets/directive-excalidraw/client.js"))).toBe(true);
    expect(existsSync(path.join(out, "__hyperbook_assets/directive-excalidraw/hyperbook-excalidraw.umd.js"))).toBe(false);

    // The shared address serves the runtime, extracted from the CLI's archive.
    const runtime = await instance.app.request(`${base}directive-excalidraw/hyperbook-excalidraw.umd.js`, {
      headers: { host: `${bookRow(instance, book.id).slug}.books.test` },
    });
    expect(runtime.status).toBe(200);
    expect(runtime.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  }, 120_000);

  it("loads an element from its public CDN when the admin chose that", async () => {
    const instance = setup({}, { runner: sandboxedRunner });
    // Excalidraw follows its public CDN (UNPKG) instead of the instance.
    updateInstanceSettings(instance.db, { elementRuntimes: { excalidraw: "cdn" } });
    const { book, commit } = await bookWithSource(instance, {
      "hyperbook.json": JSON.stringify({ name: "Drawing" }),
      "book/index.md": '# Drawing\n\n::excalidraw{src="/drawing.excalidraw"}\n',
      "public/drawing.excalidraw": JSON.stringify({ type: "excalidraw", version: 2, elements: [] }),
    });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const row = buildRow(instance, build.id);
    expect(row.error, row.log).toBeNull();
    const out = buildDir(instance.config, book.id, build.id);
    const html = await readFile(path.join(out, "index.html"), "utf8");
    expect(html).toContain("https://unpkg.com/@hyperbook/web-component-excalidraw@");
    expect(html).not.toContain("/_hyperbook/assets/");
    // The small integration files stay with the book; the runtime does not.
    expect(existsSync(path.join(out, "__hyperbook_assets/directive-excalidraw/client.js"))).toBe(true);
    expect(existsSync(path.join(out, "__hyperbook_assets/directive-excalidraw/hyperbook-excalidraw.umd.js"))).toBe(false);
  }, 120_000);

  it("copies the runtime into the book that asks for cdn: false", async () => {
    const instance = setup({}, { runner: sandboxedRunner });
    const { book, commit } = await bookWithSource(instance, {
      "hyperbook.json": JSON.stringify({ name: "Offline", elements: { excalidraw: { cdn: false } } }),
      "book/index.md": '# Drawing\n\n::excalidraw{src="/drawing.excalidraw"}\n',
      "public/drawing.excalidraw": JSON.stringify({ type: "excalidraw", version: 2, elements: [] }),
    });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const row = buildRow(instance, build.id);
    expect(row.error, row.log).toBeNull();
    const out = buildDir(instance.config, book.id, build.id);
    expect(existsSync(path.join(out, "__hyperbook_assets/directive-excalidraw/hyperbook-excalidraw.umd.js"))).toBe(true);
  }, 120_000);

  it("cannot read files outside its job directory", async () => {
    const instance = setup({}, { runner: sandboxedRunner });
    // A book whose language makes the search index require() a file from
    // the server; the CLI refuses such codes, and the sandbox would stop the
    // read anyway. Either way the server's files stay out of the output.
    const { book, commit } = await bookWithSource(instance, {
      "hyperbook.json": JSON.stringify({ name: "Evil", search: true, language: "../../../../../../etc/passwd#" }),
      "book/index.md": "# Hi\n",
    });
    const build = instance.builds.enqueue(book.id, commit, "upload", null);
    await instance.builds.idle();
    const row = buildRow(instance, build.id);
    expect(row.log).not.toMatch(/root:x:0:0/);
  }, 60_000);
});
