import path from "path";
import fs from "fs/promises";
import chalk from "chalk";
import mime from "mime";
import type { ArchiveInclude, TypstJob } from "@hyperbook/markdown";
import { Hyperproject } from "@hyperbook/types";
import { excludeMatcherFor, vfile } from "@hyperbook/fs";
import { AssetManager } from "./helpers/assets";
import { reportError } from "./helpers/report-error";
import { PageRenderer, normalizeHref } from "./render";
import { runArchive, type ArchiveIncludes } from "./archive";
import { runTypst } from "./typst";
import {
  ASSETS_FOLDER,
  extractH5p,
  generateFaviconsFromLogo,
  generateLlmsTxt,
  writeSearchIndex,
  type SinglePageResult,
} from "./build";
import packageJson from "./package.json";
import type { DevBackend, FileEvent, Served } from "./dev-library";
import { formatErrorForBrowser, renderErrorPage } from "./dev-error";
import {
  InProcessIndexer,
  ProcessIndexer,
  cliBundle,
  type Indexer,
  type PageIndex,
} from "./dev-indexer";

const PAGE_FILE = /\.md(\.(hbs|json|yml))?$/;

/** Book and glossary pages, the files whose text a page is rendered from. */
const isPageSource = (file: string) =>
  /^(book|glossary)[\\/]/.test(file) && PAGE_FILE.test(file);

/**
 * A book in the dev server, rendered the way the cloud editor's preview does
 * it: nothing is built up front, each page renders when it is asked for, and
 * stays as rendered until something in the book changes. What a full build
 * makes besides the pages is made when it is asked for too: the search
 * index, the archives, llms.txt, unpacked H5P files. Files of the book
 * (public/, images next to pages) are served from where they are.
 *
 * Meanwhile every page is rendered once in the background, in a process of
 * its own (see dev-indexer.ts) so no request waits for it. That fills the
 * search index and collects the archives' includes, which a full build gets
 * from rendering every page; afterwards a page is indexed again when it is
 * rendered or edited.
 */
export class BookBackend implements DevBackend {
  private renderer!: PageRenderer;
  private readonly rootOut: string;
  /** Pages rendered since the last change, by address, to their output. */
  private fresh = new Map<string, string>();
  /** Everything that uses the renderer, one after the other. */
  private lane: Promise<unknown> = Promise.resolve();
  /** What the pages put in the search index and the archives, by page file. */
  private searchDocuments = new Map<string, any[]>();
  private archiveIncludes = new Map<string, Record<string, ArchiveInclude[]>>();
  /** Typst documents and offered `.typ` sources, by page file. */
  private typstJobs = new Map<string, TypstJob[]>();
  private typstDownloads = new Map<string, string[]>();
  private searchStale = true;
  private archivesStale = true;
  private llmsStale = true;
  /** Unpacked H5P files by address, with the source's mtime they came from. */
  private h5p = new Map<string, Promise<void>>();
  private indexer!: Indexer;
  private indexing: Promise<void> | null = null;
  private indexAgain = false;
  /** Counts changes, so an index made before one is not taken for current. */
  private generation = 0;
  /** The last render failure printed, so a reload does not print it again. */
  private lastReported = "";

  constructor(
    private readonly root: string,
    private readonly rootProject: Hyperproject,
    private readonly assets: AssetManager,
  ) {
    this.rootOut = path.join(root, ".hyperbook", "out");
  }

  async start(): Promise<void> {
    // A build's output would be served as if it were this session's: a page
    // deleted since, a public file changed since.
    await fs.rm(this.rootOut, { recursive: true, force: true });
    await this.reset();
    const cli = cliBundle();
    this.indexer = cli
      ? new ProcessIndexer(cli, this.root)
      : new InProcessIndexer(
          () => this.renderer,
          (run) => this.exclusive(run),
        );
    this.index();
  }

  /** A new renderer, with Hyperbook's assets in place for the settings now. */
  private async reset(): Promise<void> {
    this.renderer = new PageRenderer(this.root, this.rootProject, this.assets, {
      keepBook: true,
    });
    await this.renderer.prepare();
    // prepare() put an empty search index in place of the real one.
    this.searchStale = true;
    void this.favicons();
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.lane.then(run);
    this.lane = result.catch(() => {});
    return result;
  }

  async serve(pathname: string): Promise<Served | null> {
    const segments = pathname.split("/");
    if (segments.some((s) => s === "..")) return null;
    const last = segments[segments.length - 1] || "";
    const pageLike = !last.includes(".") || last.endsWith(".html");

    if (pageLike && !pathname.startsWith("@/")) {
      const page = await this.page("/" + pathname);
      if (page) return page;
    }

    try {
      if (pathname === `${ASSETS_FOLDER}/search.js`) await this.writeSearch();
      if (pathname.startsWith("archives/")) await this.writeArchives();
      if (pathname === "llms.txt") await this.writeLlms();
      await this.unpackH5p(segments);
      // A Typst document a page shows: built now, or taken from the cache
      // when nothing it is made of changed since.
      const job = this.typstJob("/" + pathname);
      if (job) await this.buildTypst(job);
    } catch (e) {
      reportError(e);
      return {
        status: 500,
        type: "text/plain; charset=utf-8",
        body: formatErrorForBrowser(e),
      };
    }

    const file = await this.find(pathname, pageLike);
    if (!file) return null;
    return {
      status: 200,
      type: mime.getType(file) || "application/octet-stream",
      file,
    };
  }

  private typstJob(href: string): TypstJob | undefined {
    for (const jobs of this.typstJobs.values()) {
      const job = jobs.find((j) => j.out === href);
      if (job) return job;
    }
    return undefined;
  }

  private buildTypst(job: TypstJob): Promise<void> {
    return this.exclusive(async () => {
      const { json } = await this.renderer.book();
      await runTypst({
        root: this.root,
        rootOut: this.rootOut,
        config: json,
        jobs: [job],
        // A collision is the build's to report; here the document wins.
        copied: new Map(),
        prefix: "Typst",
      });
    });
  }

  /** The page at `href`, rendered unless it is fresh; null if no page is there. */
  private page(href: string): Promise<Served | null> {
    return this.exclusive(async () => {
      const key = normalizeHref(href);
      let out = this.fresh.get(key);
      if (!out) {
        const start = performance.now();
        let rendered;
        try {
          rendered = await this.renderer.renderPage({ href });
        } catch (e) {
          const message = formatErrorForBrowser(e);
          if (message !== this.lastReported) {
            this.lastReported = message;
            reportError(e);
          }
          return {
            status: 500,
            type: "text/html; charset=utf-8",
            body: renderErrorPage("This page could not be rendered", message),
          };
        }
        if (!rendered.result.ok || !rendered.page) return null;
        this.lastReported = "";
        this.record(rendered.result.file, rendered.page);
        out = rendered.result.out;
        this.fresh.set(key, out);
        console.log(
          `${chalk.green("[Render]")} ${rendered.result.href} ${chalk.dim(
            `${(performance.now() - start).toFixed(0)}ms`,
          )}`,
        );
      }
      return {
        status: 200,
        type: "text/html; charset=utf-8",
        body: await fs.readFile(path.join(this.rootOut, out)),
      };
    });
  }

  private record(file: string, page: PageIndex | SinglePageResult) {
    this.searchDocuments.set(file, page.searchDocuments);
    this.archiveIncludes.set(file, page.archiveIncludes);
    this.typstJobs.set(file, page.typstJobs ?? []);
    this.typstDownloads.set(file, page.typstDownloads ?? []);
    this.searchStale = true;
    this.archivesStale = true;
  }

  /**
   * Indexes, a page at a time, every page not indexed yet. Called again while
   * it runs, it starts over with the pages as they are then.
   */
  private index(): void {
    if (this.indexing) {
      this.indexAgain = true;
      return;
    }
    this.indexing = (async () => {
      const start = performance.now();
      let indexed = 0;
      do {
        this.indexAgain = false;
        let files: string[];
        try {
          files = await this.indexer.pages();
        } catch {
          // The book cannot be read right now; its pages say why.
          break;
        }
        const known = new Set(files);
        for (const file of [...this.searchDocuments.keys()]) {
          if (!known.has(file)) {
            this.searchDocuments.delete(file);
            this.archiveIncludes.delete(file);
            this.typstJobs.delete(file);
            this.typstDownloads.delete(file);
            this.searchStale = this.archivesStale = true;
          }
        }
        for (const file of files) {
          if (this.indexAgain) break;
          if (this.searchDocuments.has(file)) continue;
          // Requests that came in meanwhile go first.
          await new Promise((resolve) => setImmediate(resolve));
          const generation = this.generation;
          let page: PageIndex | null;
          try {
            page = await this.indexer.index(file);
          } catch {
            // The indexer is gone; what is indexed stays.
            return;
          }
          // Made from the book before a change: indexed again after it.
          if (generation !== this.generation) continue;
          // Not tried again until the page changes.
          this.record(file, page ?? { searchDocuments: [], archiveIncludes: {} });
          indexed++;
        }
      } while (this.indexAgain);
      if (indexed > 1) {
        console.log(
          `${chalk.green("[Index]")} ${indexed} pages indexed for search and archives in ${(
            (performance.now() - start) /
            1000
          ).toFixed(1)}s`,
        );
      }
    })().finally(() => {
      this.indexing = null;
    });
  }

  async change(files: [string, FileEvent][]): Promise<"*"> {
    await this.exclusive(async () => {
      this.generation++;
      this.indexer.invalidate();
      this.fresh.clear();
      if (files.some(([file]) => file === "hyperbook.json")) {
        await this.reset();
      } else {
        this.renderer.invalidate();
      }
      // Edited pages are indexed again; pages that only use a changed
      // snippet or template are when they are next rendered.
      for (const [file] of files) {
        if (isPageSource(file)) this.searchDocuments.delete(file);
      }
      this.archivesStale = true;
      this.llmsStale = true;
    });
    this.index();
    // Any page may show what changed (navigation, snippets, glossary).
    return "*";
  }

  async rebuild(): Promise<void> {
    await this.exclusive(async () => {
      this.generation++;
      this.indexer.invalidate();
      this.fresh.clear();
      this.searchDocuments.clear();
      this.archiveIncludes.clear();
      this.typstJobs.clear();
      this.typstDownloads.clear();
      this.h5p.clear();
      this.archivesStale = this.llmsStale = true;
      await fs.rm(this.rootOut, { recursive: true, force: true });
      await this.reset();
    });
    this.index();
  }

  private async writeSearch(): Promise<void> {
    if (!this.searchStale) return;
    await this.exclusive(async () => {
      const { json, baseCtx } = await this.renderer.book();
      if (!json.search || !this.searchStale) return;
      this.searchStale = false;
      await writeSearchIndex(
        json,
        baseCtx,
        [...this.searchDocuments.values()].flat(),
        this.rootOut,
        "Search",
      );
    });
  }

  /** Zips the archives with every page's includes, once every page is indexed. */
  private async writeArchives(): Promise<void> {
    if (!this.archivesStale) return;
    if (this.indexing) {
      console.log(
        `${chalk.yellow("[Archives]")} Waiting for every page to be indexed, for the includes.`,
      );
      while (this.indexing) await this.indexing;
    }
    await this.exclusive(async () => {
      if (!this.archivesStale) return;
      const includes: ArchiveIncludes = {};
      for (const perPage of this.archiveIncludes.values()) {
        for (const [name, list] of Object.entries(perPage)) {
          (includes[name] ||= []).push(...list);
        }
      }
      await runArchive(this.root, this.rootOut, "Archives", includes);
      this.archivesStale = false;
    });
  }

  private async writeLlms(): Promise<void> {
    if (!this.llmsStale) return;
    await this.exclusive(async () => {
      const { json, pagesAndSections } = await this.renderer.book();
      if (!json.llms || !this.llmsStale) return;
      await generateLlmsTxt(
        this.root,
        this.rootOut,
        json,
        pagesAndSections,
        packageJson.version,
      );
      this.llmsStale = false;
    });
  }

  /** An .h5p file is read by the player as a folder: unpacked on first use. */
  private async unpackH5p(segments: string[]): Promise<void> {
    const at = segments.findIndex((s) => s.endsWith(".h5p"));
    // The file itself, without anything below it, is served as it is.
    if (at < 0 || at === segments.length - 1) return;
    const href = segments.slice(0, at + 1).join("/");
    const source = await this.source(href);
    if (!source) return;
    const { mtimeMs } = await fs.stat(source);
    const key = `${href}@${mtimeMs}`;
    let unpacking = this.h5p.get(key);
    if (!unpacking) {
      unpacking = extractH5p(
        source,
        path.join(this.rootOut, href),
        path.join(this.rootOut, ASSETS_FOLDER),
      );
      this.h5p.set(key, unpacking);
      unpacking.catch(() => this.h5p.delete(key));
    }
    await unpacking;
  }

  /**
   * A file of the book at `pathname`, where a build would have copied it
   * from: public/, book/ or glossary/ (but not the pages' own text).
   */
  private async source(pathname: string): Promise<string | null> {
    const candidates = [path.join(this.root, "public", pathname)];
    if (!PAGE_FILE.test(pathname)) {
      candidates.push(path.join(this.root, "book", pathname));
      if (pathname.startsWith("glossary/")) {
        candidates.push(path.join(this.root, pathname));
      }
    }
    // `exclude` in hyperbook.json: a build would not have copied the file.
    const excluded = excludeMatcherFor(
      await vfile.getJson(this.root).catch(() => null),
    );
    if (excluded(pathname)) return null;
    // Nor a Typst source, unless a page offers it for download.
    if (/\.typ$/i.test(pathname)) {
      const href = "/" + pathname;
      const offered = [...this.typstDownloads.values()].some((hrefs) => hrefs.includes(href));
      if (!offered) return null;
    }
    for (const candidate of candidates) {
      if (!candidate.startsWith(this.root + path.sep)) continue;
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isFile()) return candidate;
    }
    return null;
  }

  /**
   * The file to serve at `pathname`: what this session made, then the book's
   * own files. Pages come only from page(): an output page found here is
   * left over from one that no longer exists.
   */
  private async find(pathname: string, pageLike: boolean): Promise<string | null> {
    if (!pageLike || pathname.startsWith("@/")) {
      const made = path.join(this.rootOut, pathname);
      if (made.startsWith(this.rootOut + path.sep)) {
        const stat = await fs.stat(made).catch(() => null);
        if (stat?.isFile()) return made;
      }
    }
    return this.source(pathname);
  }

  /** Favicons from the logo, like a build makes them, unless the book has some. */
  private async favicons(): Promise<void> {
    try {
      const { json } = await this.exclusive(() => this.renderer.book());
      if (!json.logo) return;
      if (await this.source("favicon.ico")) return;
      if (await fs.stat(path.join(this.rootOut, "favicon.ico")).catch(() => null)) {
        return;
      }
      await generateFaviconsFromLogo(this.root, this.rootOut, json, "Favicons");
    } catch {
      // A book that cannot be read: its pages say why.
    }
  }
}
