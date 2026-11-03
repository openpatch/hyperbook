import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { books } from "../src/server/db/schema";
import { BookChecks } from "../src/server/hosting/checks";
import { commitTree, initRepo } from "../src/server/hosting/git";
import { type RenderSpawner, Renderers } from "../src/server/hosting/renders";
import { makeJobDir, repoDir } from "../src/server/hosting/storage";
import { type Instance, setup, textRender } from "./helpers";

const who = { name: "Ada", email: "ada@example.org" };

async function commitFiles(instance: Instance, bookId: number, files: Record<string, string>) {
  const repo = repoDir(instance.config, bookId);
  await initRepo(repo);
  const dir = await makeJobDir(instance.config, "test");
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  return (await commitTree(repo, dir, { message: "Save", author: who, committer: who })).commit;
}

function newBook(instance: Instance) {
  return instance.db.insert(books).values({ slug: "physics", title: "Physics" }).returning().get();
}

/** Like textRender, but a page whose text says "broken" fails; `onRender` sees each page. */
const failingRender =
  (onRender: (file: string) => Promise<void> | void = () => {}): RenderSpawner =>
  async (job) => {
    const inner = await textRender(job);
    return {
      async render(target) {
        if ("file" in target) {
          await onRender(target.file);
          const text = await readFile(path.join(job.srcDir, target.file), "utf8");
          if (text.includes("broken")) return { ok: false, error: `Cannot render ${target.file}`, log: "" };
        }
        return inner.render(target);
      },
      close: () => inner.close(),
    };
  };

describe("page checks", () => {
  it("renders every page of the latest save and lists the ones that fail", async () => {
    const instance = setup();
    const book = newBook(instance);
    const commit = await commitFiles(instance, book.id, {
      "hyperbook.json": "{}",
      "book/index.md": "# Hi",
      "book/a/broken.md": "this is broken",
      "glossary/term.md": "# Term",
      "snippets/not-a-page.md": "broken, but not a page",
    });
    const renders = new Renderers(instance.config, failingRender());
    const checks = new BookChecks(renders);
    checks.start(book.id);
    const state = await checks.settled(book.id);
    expect(state).toMatchObject({
      status: "done",
      commit,
      total: 3,
      done: 3,
      problems: [{ file: "book/a/broken.md", error: "Cannot render book/a/broken.md" }],
    });
    renders.closeAll();
  });

  it("checks saved text, not the editor's unsaved text", async () => {
    const instance = setup();
    const book = newBook(instance);
    await commitFiles(instance, book.id, { "hyperbook.json": "{}", "book/index.md": "# Fine" });
    const renders = new Renderers(instance.config, failingRender());
    await renders.renderText(book.id, "book/index.md", "broken while typing");
    const checks = new BookChecks(renders);
    checks.start(book.id);
    expect(await checks.settled(book.id)).toMatchObject({ status: "done", problems: [] });
    renders.closeAll();
  });

  it("stops when a save moves the book on", async () => {
    const instance = setup();
    const book = newBook(instance);
    await commitFiles(instance, book.id, { "hyperbook.json": "{}", "book/a.md": "a", "book/b.md": "b" });
    let saved = false;
    const renders = new Renderers(
      instance.config,
      failingRender(async () => {
        if (saved) return;
        saved = true;
        await commitFiles(instance, book.id, { "hyperbook.json": "{}", "book/a.md": "a2", "book/b.md": "b" });
      }),
    );
    const checks = new BookChecks(renders);
    checks.start(book.id);
    expect(await checks.settled(book.id)).toMatchObject({ status: "changed", done: 1, total: 2 });
    renders.closeAll();
  });

  it("says why a check could not run", async () => {
    const instance = setup();
    const book = newBook(instance);
    const renders = new Renderers(instance.config, failingRender());
    const checks = new BookChecks(renders);
    checks.start(book.id);
    expect(await checks.settled(book.id)).toMatchObject({ status: "failed", error: "The book has no files yet" });
    renders.closeAll();
  });
});
