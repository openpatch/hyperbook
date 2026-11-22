import type { IndexedElement } from "../domain/overview";
import { LocalizedError } from "../localized-error";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";
import {
  checkout,
  headCommit,
  listTree,
  markProjectRoot,
  updateCheckout,
} from "./git";
import { BuildLog, adaptConfig, cliChildEnv, cliPermissions } from "./runner";
import { makeJobDir, repoDir } from "./storage";
import { createHash } from "node:crypto";
import { type TypstJob, isPlainRelative, typstServiceFor, typstSettingsOf, typstVersions } from "./typst";
import { type PageDiagnostic, readDiagnostics } from "../../shared/page-diagnostics";

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
      /** The page's title and the tasks on it that keep a reader's work. */
      title?: string;
      storedElements?: IndexedElement[];
      /** What is wrong with the page, when asked for (see RenderOptions). */
      diagnostics?: PageDiagnostic[];
    }
  | { ok: false; error: string; log: string; diagnostics?: PageDiagnostic[] };

export type RenderOptions = {
  /** Also say what is wrong with the page, as `hyperbook lint` would. */
  diagnostics?: boolean;
};

/** What is wrong with a page, said without rendering it. */
export type PageLint =
  | { ok: true; file: string; diagnostics: PageDiagnostic[] }
  | { ok: false; error: string };

/**
 * One `hyperbook render` (or a stand-in in tests) working on `srcDir`. A
 * stand-in may know nothing of lint: then there are no diagnostics.
 */
export type RenderProcess = {
  render(target: RenderTarget, options?: RenderOptions): Promise<PageRender>;
  /** The diagnostics of a page, without rendering it. */
  lint?(target: RenderTarget): Promise<PageLint>;
  /** What is wrong with the book as a whole (options, permaids claimed twice). */
  lintBook?(): Promise<PageDiagnostic[]>;
  /** Files changed that the process keeps (the public files, for links). */
  invalidate?(): Promise<void>;
  close(): void;
};

/** A step of a check of every page (see Renderers.checkPages). */
export type CheckStep = {
  progress: { done: number; total: number; commit: string };
  /** The page did not render. */
  problem?: { file: string; error: string };
  /** The page rendered: its title and the tasks on it that keep a reader's work. */
  page?: { href: string; title: string; elements: IndexedElement[] };
  /** What `hyperbook lint` says about the page, or the book as a whole. */
  diagnostics?: PageDiagnostic[];
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
  /** Sends one request once the ones before it are answered; with what it logged. */
  const ask = (request: object) => {
    const run = queue.then(async () => {
      const before = log.toString().length;
      const reply = next();
      child.stdin.write(JSON.stringify({ id: ++id, ...request }) + "\n");
      const r = await reply;
      return { r, output: log.toString().slice(before).trim() };
    });
    queue = run.catch(() => {});
    return run;
  };
  const proc: RenderProcess = {
    async render(target, options = {}) {
      const { r, output } = await ask({ ...target, ...(options.diagnostics ? { diagnostics: true } : {}) });
      const diagnostics = options.diagnostics ? { diagnostics: readDiagnostics(r.diagnostics) } : {};
      return r.ok
        ? {
            ok: true,
            href: String(r.href),
            file: String(r.file),
            out: String(r.out),
            log: output,
            typstJobs: Array.isArray(r.typstJobs) ? (r.typstJobs as TypstJob[]) : [],
            typstDownloads: Array.isArray(r.typstDownloads) ? (r.typstDownloads as string[]) : [],
            title: typeof r.title === "string" ? r.title : undefined,
            storedElements: Array.isArray(r.storedElements) ? (r.storedElements as IndexedElement[]) : [],
            ...diagnostics,
          }
        : { ok: false, error: String(r.error ?? "Rendering failed"), log: output, ...diagnostics };
    },
    async lint(target) {
      const { r } = await ask({ ...target, lint: true });
      return r.ok
        ? { ok: true, file: String(r.file), diagnostics: readDiagnostics(r.diagnostics) }
        : { ok: false, error: String(r.error ?? "Linting failed") };
    },
    async lintBook() {
      const { r } = await ask({ lint: "book" });
      if (!r.ok) throw new Error(String(r.error ?? "Linting failed"));
      return readDiagnostics(r.diagnostics);
    },
    async invalidate() {
      await ask({ invalidate: true });
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

export class RenderError extends LocalizedError {}

/** The book has no hyperbook.json (or hyperlibrary.json): nothing can render. */
export class MissingConfigError extends RenderError {
  constructor() {
    super("errors.files.noConfig");
  }
}

const CONFIGS = new Set(["hyperbook.json", "hyperlibrary.json"]);

/** A preview PDF, or why there is none. */
export type TypstPreview = { ok: true; file: string } | { ok: false; error: string; diagnostics: string };

const PAGE = /^(book|glossary)\/.+\.(md|md\.hbs|md\.json|md\.yml)$/;

/** Only pages of the book have unsaved text that renders. */
function assertPage(file: string) {
  if (!PAGE.test(file) || file.split("/").some((s) => s === ".." || s === "." || s === "")) {
    throw new RenderError("errors.files.previewPagesOnly");
  }
}

/** Every book being edited, with its renderer. */
export class Renderers {
  private renderers = new Map<number, Renderer>();
  private starting = new Map<number, Promise<Renderer>>();
  /** Stops each running check of all pages (see checkPages). */
  private checking = new Set<() => void>();
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
    if (!commit) throw new RenderError("errors.publishing.noFiles");
    let r = this.renderers.get(bookId);
    if (!r || r.commit !== commit) {
      // The CLI would only stop at once, for every page asked for.
      const tree = await listTree(repo, commit);
      if (!tree.some((e) => CONFIGS.has(e.path))) {
        if (r) this.close(bookId);
        throw new MissingConfigError();
      }
    }
    if (!r) {
      this.evict();
      const { jobDir, srcDir } = await this.checkoutFor(bookId, commit, "render");
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

  /** A checkout of `commit` in a job folder of its own, ready for `hyperbook render`. */
  private async checkoutFor(bookId: number, commit: string, kind: string) {
    const jobDir = await makeJobDir(this.config, `${kind}-${bookId}`);
    const srcDir = path.join(jobDir, "src");
    await mkdir(srcDir);
    await checkout(repoDir(this.config, bookId), commit, srcDir);
    // So the book's rfile/rbase64 helpers see the checkout as the project root.
    await markProjectRoot(srcDir);
    await adaptConfig(srcDir, new BuildLog());
    return { jobDir, srcDir };
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
      } else {
        // The save may have added or removed public files that links point at.
        await (await r.process).invalidate?.();
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
   * for the pages rendered after it until the next save. Says what is wrong
   * with it, too, for the editor's lint gutter.
   */
  async renderText(bookId: number, file: string, text: string): Promise<PageRender> {
    assertPage(file);
    const r = await this.renderer(bookId);
    return this.exclusive(r, async () => {
      await this.override(r, file, text);
      return this.run(r, { file }, { diagnostics: true });
    });
  }

  /**
   * What is wrong with the page `file` with the editor's `text`, without
   * rendering it: for the lint gutter while the preview is closed. The text
   * stays in place like renderText's.
   */
  async lintText(bookId: number, file: string, text: string): Promise<PageLint> {
    assertPage(file);
    const r = await this.renderer(bookId);
    return this.exclusive(r, async () => {
      await this.override(r, file, text);
      const process = await r.process;
      if (!process.lint) return { ok: true, file, diagnostics: [] };
      return process.lint({ file });
    });
  }

  /**
   * Puts the editor's `text` of `file` into the checkout (under the lock),
   * in place of the one file with unsaved text before it. What was rendered
   * goes stale only if the files changed.
   */
  private async override(r: Renderer, file: string, text: string) {
    const full = path.join(r.srcDir, file);
    if (r.override && r.override.file !== file) await this.restore(r);
    const current = await readFile(full, "utf8").catch(() => null);
    if (!r.override) r.override = { file, saved: current, text };
    r.override.text = text;
    if (current === text) return;
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text);
    r.fresh.clear();
    r.generation++;
  }

  /** Puts the saved text of the overridden page back. */
  private async restore(r: Renderer) {
    if (!r.override) return;
    const full = path.join(r.srcDir, r.override.file);
    if (r.override.saved === null) await rm(full, { force: true });
    else await writeFile(full, r.override.saved);
    r.override = null;
  }

  private async run(r: Renderer, target: RenderTarget, options?: RenderOptions): Promise<PageRender> {
    const result = await (await r.process).render(target, options);
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
    // Under the checkout's lock: a save or the editor's text must not
    // change the files while Typst reads them.
    return this.exclusive(r, () => this.compileTypst(r, job));
  }

  /**
   * The editor's preview of a `.typ` file: compiled with `text`, which stays
   * in the checkout like a page's unsaved text until the next save.
   */
  async typstText(bookId: number, file: string, text: string): Promise<TypstPreview> {
    if (!/\.typ$/i.test(file) || !isPlainRelative(file)) {
      throw new RenderError("errors.files.previewTypOnly");
    }
    const r = await this.renderer(bookId);
    // Written and compiled under the checkout's lock: a page's unsaved text
    // puts this file's saved text back (also under it), and must not do so
    // in between.
    return this.exclusive(r, async () => {
      await this.override(r, file, text);
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
   * of the whole book. It runs on a checkout and a `hyperbook render` of its
   * own, so the editor's preview never waits behind it (a page that takes
   * long, like one that gathers the whole book, would hold it up), and it
   * sees only saved text, which is what gets published. Each page comes with
   * what `hyperbook lint` says about it, and at the end the book as a whole.
   * Stops (returning "changed") when a save moves the book on; `signal`
   * stops it, too.
   */
  async checkPages(
    bookId: number,
    onStep: (step: CheckStep) => void,
    signal?: AbortSignal,
  ): Promise<"done" | "changed" | "aborted"> {
    const repo = repoDir(this.config, bookId);
    const commit = await headCommit(repo).catch(() => null);
    if (!commit) throw new RenderError("errors.publishing.noFiles");
    if (!(await listTree(repo, commit)).some((e) => CONFIGS.has(e.path))) throw new MissingConfigError();
    const { jobDir, srcDir } = await this.checkoutFor(bookId, commit, "check");
    const process = this.spawner({ config: this.config, srcDir, cdnElements: this.cdnElements() });
    const stop = () => {
      void process.then((p) => p.close(), () => {});
      void rm(jobDir, { recursive: true, force: true });
    };
    this.checking.add(stop);
    try {
      const files = await pageFiles(srcDir);
      onStep({ progress: { done: 0, total: files.length, commit } });
      const moved = async () => (await headCommit(repo).catch(() => null)) !== commit;
      const p = await process;
      for (const [i, file] of files.entries()) {
        if (signal?.aborted) return "aborted";
        if (await moved()) return "changed";
        const result = await p.render({ file }, { diagnostics: true });
        onStep({
          progress: { done: i + 1, total: files.length, commit },
          problem: result.ok ? undefined : { file, error: result.error },
          page: result.ok
            ? { href: result.href, title: result.title ?? result.href, elements: result.storedElements ?? [] }
            : undefined,
          diagnostics: result.diagnostics,
        });
      }
      if (signal?.aborted) return "aborted";
      if (await moved()) return "changed";
      onStep({ progress: { done: files.length, total: files.length, commit }, diagnostics: (await p.lintBook?.()) ?? [] });
      return "done";
    } finally {
      this.checking.delete(stop);
      stop();
    }
  }

  /**
   * Folders a file of the preview may come from, in order, and the address
   * each one is served under: book/ and public/ at the root, glossary/ under
   * /glossary, as the build copies them.
   */
  async roots(bookId: number): Promise<{ dir: string; under: string | null }[]> {
    const r = await this.renderer(bookId);
    return [
      { dir: path.join(r.srcDir, ".hyperbook", "out"), under: null },
      { dir: path.join(r.srcDir, "public"), under: null },
      { dir: path.join(r.srcDir, "book"), under: null },
      { dir: path.join(r.srcDir, "glossary"), under: "glossary" },
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
    for (const stop of this.checking) stop();
    this.checking.clear();
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
