import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";
import {
  checkout,
  headCommit,
  markProjectRoot,
  updateCheckout,
} from "./git";
import { BuildLog, adaptConfig, cliChildEnv, cliPermissions } from "./runner";
import { makeJobDir, repoDir } from "./storage";
import { createHash } from "node:crypto";
import { type TypstJob, isPlainRelative, typstServiceFor, typstSettingsOf, typstVersions } from "./typst";

/*
 * Single pages rendered for the editor's preview, without a build. Each book
 * being edited gets a checkout of its newest save and a `hyperbook render`
 * process on it, sandboxed like a build (see runner.ts). The editor's unsaved
 * text of a page is written into the checkout before that page renders; the
 * preview host serves the output, rendering pages as they are visited.
 */

/** A page's file relative to the book, or its address. */
export type RenderTarget = { file: string } | { href: string };

export type PageRender =
  | {
      ok: true;
      href: string;
      file: string;
      out: string;
      log: string;
      /** Typst documents the page shows, and `.typ` sources it offers (see hosting/typst.ts). */
      typstJobs?: TypstJob[];
      typstDownloads?: string[];
    }
  | { ok: false; error: string; log: string };

/** One `hyperbook render` (or a stand-in in tests) working on `srcDir`. */
export type RenderProcess = {
  render(target: RenderTarget): Promise<PageRender>;
  close(): void;
};

/** Elements whose runtimes the admin loads from their public CDN, not this instance. */
export type CdnElements = () => string[];

export type RenderSpawner = (job: { config: Config; srcDir: string; cdnElements: string[] }) => Promise<RenderProcess>;

const REPLY = "@hyperbook-render ";
/** How long a book's renderer stays without being used. */
const IDLE_MS = 10 * 60 * 1000;
/** The most renderers at once; the longest unused one makes way. */
const MAX_RENDERERS = 8;

/** Runs the CLI's render mode with the build's sandbox. */
export const sandboxedRender: RenderSpawner = async ({ config, srcDir, cdnElements }) => {
  const cli = config.build.cli;
  if (!existsSync(cli)) {
    throw new Error(`The Hyperbook CLI is missing at ${cli}. Build it with: pnpm --filter hyperbook build`);
  }
  const jobDir = path.dirname(srcDir);
  const child = spawn(
    process.execPath,
    [
      ...cliPermissions(config, jobDir),
      `--max-old-space-size=${config.build.memoryMb}`,
      cli,
      "render",
      "--offline",
    ],
    {
      cwd: srcDir,
      env: await cliChildEnv(config, jobDir, cdnElements),
      stdio: ["pipe", "pipe", "pipe"],
    },
  ) as ChildProcessWithoutNullStreams;
  return renderProcess(child, config.build.timeoutMs, srcDir);
};

/** Talks to a running `hyperbook render`: one request at a time. */
function renderProcess(child: ChildProcessWithoutNullStreams, timeoutMs: number, srcDir: string): Promise<RenderProcess> {
  const log = new BuildLog();
  log.redact(srcDir, "<book>");
  let waiting: ((reply: Record<string, unknown> | Error) => void) | null = null;
  let exited: Error | null = null;
  let buffer = "";

  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith(REPLY)) {
        log.write(line + "\n");
        continue;
      }
      const reply = JSON.parse(line.slice(REPLY.length)) as Record<string, unknown>;
      const resolve = waiting;
      waiting = null;
      resolve?.(reply);
    }
  });
  child.stderr.setEncoding("utf8").on("data", (d: string) => log.write(d));
  child.stdin.on("error", () => {});
  child.on("close", (code) => {
    exited = new Error(`The renderer stopped (exit code ${code}): ${log.toString().split("\n").slice(-5).join("\n")}`);
    const resolve = waiting;
    waiting = null;
    resolve?.(exited);
  });

  const next = () =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      if (exited) return reject(exited);
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Rendering took longer than ${timeoutMs / 1000} seconds and was stopped`));
      }, timeoutMs);
      waiting = (reply) => {
        clearTimeout(timer);
        if (reply instanceof Error) reject(reply);
        else resolve(reply);
      };
    });

  let id = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const proc: RenderProcess = {
    render(target) {
      const run = queue.then(async (): Promise<PageRender> => {
        const before = log.toString().length;
        const reply = next();
        child.stdin.write(JSON.stringify({ id: ++id, ...target }) + "\n");
        const r = await reply;
        const output = log.toString().slice(before).trim();
        return r.ok
          ? {
              ok: true,
              href: String(r.href),
              file: String(r.file),
              out: String(r.out),
              log: output,
              typstJobs: Array.isArray(r.typstJobs) ? (r.typstJobs as TypstJob[]) : [],
              typstDownloads: Array.isArray(r.typstDownloads) ? (r.typstDownloads as string[]) : [],
            }
          : { ok: false, error: String(r.error ?? "Rendering failed"), log: output };
      });
      queue = run.catch(() => {});
      return run;
    },
    close() {
      child.kill("SIGKILL");
    },
  };
  // The first reply says the assets are in place.
  return next().then(() => proc);
}

type Renderer = {
  bookId: number;
  jobDir: string;
  srcDir: string;
  commit: string;
  process: Promise<RenderProcess>;
  /** hyperbook.json as checked out, to notice when the process must restart. */
  settings: string;
  /** The page with the editor's unsaved text, and its saved text (null: new file). */
  override: { file: string; saved: string | null; text: string } | null;
  /** Pages rendered since the last change, by address. */
  fresh: Map<string, string>;
  /** Typst documents the rendered pages show, by address; `.typ` sources they offer. */
  typstJobs: Map<string, TypstJob>;
  typstDownloads: Set<string>;
  /** Preview PDFs, by address, with the checkout's state they were made from. */
  typstPdfs: Map<string, { generation: number; file: Promise<TypstPreview> }>;
  /** Counts changes to the checkout: a preview PDF of an older one is stale. */
  generation: number;
  lastUsed: number;
  /** Changes to the checkout, one after the other. */
  lock: Promise<unknown>;
};

export class RenderError extends Error {}

/** A preview PDF, or why there is none. */
export type TypstPreview = { ok: true; file: string } | { ok: false; error: string; diagnostics: string };

const PAGE = /^(book|glossary)\/.+\.(md|md\.hbs|md\.json|md\.yml)$/;

/** Every book being edited, with its renderer. */
export class Renderers {
  private renderers = new Map<number, Renderer>();
  private starting = new Map<number, Promise<Renderer>>();
  private sweeper: NodeJS.Timeout;

  constructor(
    private readonly config: Config,
    private readonly spawner: RenderSpawner = sandboxedRender,
    /** Read per renderer, so the admin's choice applies without a restart. */
    private readonly cdnElements: CdnElements = () => [],
  ) {
    this.sweeper = setInterval(() => this.sweep(), 60 * 1000);
    this.sweeper.unref();
  }

  /** The book's renderer on its newest save, made or brought up to date. */
  private async renderer(bookId: number): Promise<Renderer> {
    // Two requests at once must not check the book out twice.
    const pending = this.starting.get(bookId);
    if (pending) return pending;
    const started = this.start(bookId).finally(() => this.starting.delete(bookId));
    this.starting.set(bookId, started);
    return started;
  }

  private async start(bookId: number): Promise<Renderer> {
    const repo = repoDir(this.config, bookId);
    const commit = await headCommit(repo).catch(() => null);
    if (!commit) throw new RenderError("The book has no files yet");
    let r = this.renderers.get(bookId);
    if (!r) {
      this.evict();
      const jobDir = await makeJobDir(this.config, `render-${bookId}`);
      const srcDir = path.join(jobDir, "src");
      await mkdir(srcDir);
      await checkout(repo, commit, srcDir);
      // So the book's rfile/rbase64 helpers see the checkout as the project root.
      await markProjectRoot(srcDir);
      await adaptConfig(srcDir, new BuildLog());
      r = {
        bookId,
        jobDir,
        srcDir,
        commit,
        process: this.spawner({ config: this.config, srcDir, cdnElements: this.cdnElements() }),
        settings: await readFile(path.join(srcDir, "hyperbook.json"), "utf8").catch(() => ""),
        override: null,
        fresh: new Map(),
        typstJobs: new Map(),
        typstDownloads: new Set(),
        typstPdfs: new Map(),
        generation: 0,
        lastUsed: Date.now(),
        lock: Promise.resolve(),
      };
      this.renderers.set(bookId, r);
      r.process.catch(() => this.close(bookId));
    } else if (r.commit !== commit) {
      await this.update(r, commit);
    }
    r.lastUsed = Date.now();
    return r;
  }

  /** Swaps the checkout for a newer save; restarts the process if the settings changed. */
  private async update(r: Renderer, commit: string) {
    await this.exclusive(r, async () => {
      if (r.commit === commit) return;
      // The unsaved text of a page does not survive a save: put the saved
      // text back, so the update below cannot mistake it for the page's.
      await this.restore(r);
      await updateCheckout(
        repoDir(this.config, r.bookId),
        r.commit,
        commit,
        r.srcDir,
      );
      await markProjectRoot(r.srcDir);
      await adaptConfig(r.srcDir, new BuildLog());
      r.commit = commit;
      r.override = null;
      r.fresh.clear();
      r.generation++;
      const settings = await readFile(path.join(r.srcDir, "hyperbook.json"), "utf8").catch(() => "");
      if (settings !== r.settings) {
        r.settings = settings;
        void r.process.then((p) => p.close(), () => {});
        await rm(path.join(r.srcDir, ".hyperbook"), { recursive: true, force: true });
        r.process = this.spawner({ config: this.config, srcDir: r.srcDir, cdnElements: this.cdnElements() });
        r.process.catch(() => this.close(r.bookId));
      }
    });
  }

  private exclusive<T>(r: Renderer, run: () => Promise<T>): Promise<T> {
    const result = r.lock.then(run);
    r.lock = result.catch(() => {});
    return result;
  }

  /**
   * Renders the page `file` with the editor's `text`, which stays in place
   * for the pages rendered after it until the next save.
   */
  async renderText(bookId: number, file: string, text: string): Promise<PageRender> {
    if (!PAGE.test(file) || file.split("/").some((s) => s === ".." || s === "." || s === "")) {
      throw new RenderError("Only pages (book/ or glossary/) can be previewed");
    }
    const r = await this.renderer(bookId);
    return this.exclusive(r, async () => {
      const full = path.join(r.srcDir, file);
      if (r.override && r.override.file !== file) await this.restore(r);
      if (!r.override) {
        r.override = { file, saved: await readFile(full, "utf8").catch(() => null), text };
      }
      r.override.text = text;
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text);
      r.fresh.clear();
      r.generation++;
      return this.run(r, { file });
    });
  }

  /** Puts the saved text of the overridden page back. */
  private async restore(r: Renderer) {
    if (!r.override) return;
    const full = path.join(r.srcDir, r.override.file);
    if (r.override.saved === null) await rm(full, { force: true });
    else await writeFile(full, r.override.saved);
    r.override = null;
  }

  private async run(r: Renderer, target: RenderTarget): Promise<PageRender> {
    const result = await (await r.process).render(target);
    if (result.ok) {
      r.fresh.set(normalize(result.href), result.out);
      for (const job of result.typstJobs ?? []) r.typstJobs.set(job.out, job);
      for (const href of result.typstDownloads ?? []) r.typstDownloads.add(href);
    }
    return result;
  }

  /**
   * Whether the preview host may serve the file at `pathname`: a `.typ`
   * source only when a rendered page offers it for download, like a build.
   */
  async servesFile(bookId: number, pathname: string): Promise<boolean> {
    if (!/\.typ$/i.test(pathname)) return true;
    const r = await this.renderer(bookId);
    return r.typstDownloads.has(pathname);
  }

  /**
   * The PDF of a Typst document a rendered page shows, compiled from the
   * checkout as it is (the editor's unsaved text included) and kept until
   * the checkout changes. Null when no page shows a document at `pathname`.
   */
  async typstDocument(bookId: number, pathname: string): Promise<TypstPreview | null> {
    const r = await this.renderer(bookId);
    const job = r.typstJobs.get(pathname);
    if (!job) return null;
    // Under the checkout's lock: a save or a check must not change the
    // files while Typst reads them.
    return this.exclusive(r, () => this.compileTypst(r, job));
  }

  /**
   * The editor's preview of a `.typ` file: compiled with `text`, which stays
   * in the checkout like a page's unsaved text until the next save.
   */
  async typstText(bookId: number, file: string, text: string): Promise<TypstPreview> {
    if (!/\.typ$/i.test(file) || !isPlainRelative(file)) {
      throw new RenderError("Only .typ files of the book can be previewed");
    }
    const r = await this.renderer(bookId);
    // Written and compiled under the checkout's lock: "check all pages" puts
    // the saved text back (also under it), and must not do so in between.
    return this.exclusive(r, async () => {
      const full = path.join(r.srcDir, file);
      if (r.override && r.override.file !== file) await this.restore(r);
      if (!r.override) {
        r.override = { file, saved: await readFile(full, "utf8").catch(() => null), text };
      }
      if (r.override.text !== text || (await readFile(full, "utf8").catch(() => null)) !== text) {
        r.override.text = text;
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, text);
        r.fresh.clear();
        r.generation++;
      }
      return this.compileTypst(r, { src: file, out: `/__typst/${file}.pdf`, inputs: {} });
    });
  }

  private compileTypst(r: Renderer, job: TypstJob): Promise<TypstPreview> {
    const known = r.typstPdfs.get(job.out);
    if (known && known.generation === r.generation) return known.file;
    const generation = r.generation;
    const file = (async (): Promise<TypstPreview> => {
      const settings = typstSettingsOf(r.settings, typstVersions(this.config));
      if ("error" in settings) return { ok: false, error: settings.error, diagnostics: "" };
      const dir = path.join(r.jobDir, "typst-preview");
      await mkdir(dir, { recursive: true });
      const out = path.join(dir, `${createHash("sha256").update(job.out).digest("hex").slice(0, 32)}-${generation}.pdf`);
      const outcome = await typstServiceFor(this.config).preview({
        bookId: r.bookId,
        jobDir: r.jobDir,
        srcDir: r.srcDir,
        job,
        ...settings,
        out,
      });
      return outcome.ok ? { ok: true, file: out } : { ok: false, error: outcome.error, diagnostics: outcome.diagnostics };
    })();
    r.typstPdfs.set(job.out, { generation, file });
    // A failed run is not kept: the next request tries again.
    void file.then((result) => {
      if (!result.ok && r.typstPdfs.get(job.out)?.file === file) r.typstPdfs.delete(job.out);
    });
    return file;
  }

  /**
   * The output for a visit of `pathname` on the preview host: a page is
   * rendered unless it is fresh. Null if the address is not a page.
   */
  async page(bookId: number, pathname: string): Promise<{ outDir: string; render: PageRender } | null> {
    const r = await this.renderer(bookId);
    const href = normalize(pathname);
    return this.exclusive(r, async () => {
      const outDir = path.join(r.srcDir, ".hyperbook", "out");
      const fresh = r.fresh.get(href);
      if (fresh) return { outDir, render: { ok: true, href, file: "", out: fresh, log: "" } as PageRender };
      const render = await this.run(r, { href });
      if (!render.ok && render.error === "There is no page here") return null;
      return { outDir, render };
    });
  }

  /**
   * Renders every page of the newest save, one after the other, for a check
   * of the whole book: the editor's unsaved text is put back first, since
   * only saved text gets published. Pages go through the lock one by one,
   * so the preview keeps answering in between. Stops (returning "changed")
   * when a save moves the checkout on; `signal` stops it, too.
   */
  async checkPages(
    bookId: number,
    onPage: (progress: { done: number; total: number; commit: string }, problem: { file: string; error: string } | null) => void,
    signal?: AbortSignal,
  ): Promise<"done" | "changed" | "aborted"> {
    const r = await this.renderer(bookId);
    const commit = r.commit;
    const files = await this.exclusive(r, () => pageFiles(r.srcDir));
    onPage({ done: 0, total: files.length, commit }, null);
    for (const [i, file] of files.entries()) {
      if (signal?.aborted) return "aborted";
      const latest = await headCommit(repoDir(this.config, bookId)).catch(() => null);
      if (latest !== commit || r.commit !== commit || this.renderers.get(bookId) !== r) return "changed";
      const result = await this.exclusive(r, async () => {
        if (r.commit !== commit) return null;
        if (r.override) {
          await this.restore(r);
          r.fresh.clear();
        }
        r.lastUsed = Date.now();
        return this.run(r, { file });
      });
      if (!result) return "changed";
      onPage({ done: i + 1, total: files.length, commit }, result.ok ? null : { file, error: result.error });
    }
    return "done";
  }

  /** Folders a file of the preview may come from, in order. */
  async roots(bookId: number): Promise<string[]> {
    const r = await this.renderer(bookId);
    return [
      path.join(r.srcDir, ".hyperbook", "out"),
      path.join(r.srcDir, "public"),
      path.join(r.srcDir, "book"),
      path.join(r.srcDir, "glossary"),
    ];
  }

  close(bookId: number) {
    const r = this.renderers.get(bookId);
    if (!r) return;
    this.renderers.delete(bookId);
    void r.process.then((p) => p.close(), () => {});
    void rm(r.jobDir, { recursive: true, force: true });
  }

  closeAll() {
    clearInterval(this.sweeper);
    for (const bookId of [...this.renderers.keys()]) this.close(bookId);
  }

  private sweep() {
    for (const r of this.renderers.values()) {
      if (Date.now() - r.lastUsed > IDLE_MS) this.close(r.bookId);
    }
  }

  private evict() {
    if (this.renderers.size < MAX_RENDERERS) return;
    const oldest = [...this.renderers.values()].sort((a, b) => a.lastUsed - b.lastUsed)[0];
    if (oldest) this.close(oldest.bookId);
  }
}

/** The pages (book/, glossary/) of a checkout, sorted, relative to it. */
async function pageFiles(srcDir: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string) => {
    const entries = await readdir(path.join(srcDir, dir), { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(rel);
      else if (e.isFile() && PAGE.test(rel)) files.push(rel);
    }
  };
  await walk("book");
  await walk("glossary");
  return files.sort();
}

/** Like the CLI's normalizeHref: "/a/", "/a.html", "/a/index.html" → "/a". */
export function normalize(pathname: string): string {
  const h = pathname.replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/+$/, "");
  return h === "" ? "/" : h;
}
