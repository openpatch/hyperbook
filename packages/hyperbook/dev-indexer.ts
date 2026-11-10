import path from "path";
import fs from "fs";
import readline from "readline";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import type { ArchiveInclude, TypstJob } from "@hyperbook/markdown";
import { PageRenderer, RENDER_REPLY } from "./render";

/** What a page puts in the search index and the archives. */
export type PageIndex = {
  searchDocuments: any[];
  archiveIncludes: Record<string, ArchiveInclude[]>;
  /** Typst documents the page shows, and `.typ` sources it offers. */
  typstJobs?: TypstJob[];
  typstDownloads?: string[];
};

/**
 * Renders the dev server's pages in the background for what they contain.
 * The dev server's own renders must never wait for it: one page of a large
 * book can take seconds.
 */
export interface Indexer {
  /** Every page of the book, by its file relative to the book. */
  pages(): Promise<string[]>;
  /** What `file` contains; null if it is no page or cannot be rendered. */
  index(file: string): Promise<PageIndex | null>;
  /** The book changed on disk. */
  invalidate(): void;
  close(): void;
}

/**
 * The CLI's own bundle, when this runs from it: an indexer in a process of
 * its own needs a script to start. Running from source (the tests), there is
 * none.
 */
export function cliBundle(): string | null {
  const bundle = path.join(__dirname, "index.js");
  return fs.existsSync(bundle) ? bundle : null;
}

/** Indexes in a `hyperbook render --index` process, on a core of its own. */
export class ProcessIndexer implements Indexer {
  private readonly child: ChildProcessWithoutNullStreams;
  private queue: Promise<unknown> = Promise.resolve();
  private waiting: ((reply: Record<string, unknown> | Error) => void) | null =
    null;
  private exited: Error | null = null;
  private id = 0;

  constructor(cli: string, root: string) {
    this.child = spawn(
      process.execPath,
      [cli, "render", "--index", "--offline"],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
    ) as ChildProcessWithoutNullStreams;
    // What the pages print (warnings) is printed when they are visited.
    this.child.stderr.resume();
    this.child.stdin.on("error", () => {});
    readline
      .createInterface({ input: this.child.stdout })
      .on("line", (line) => {
        if (!line.startsWith(RENDER_REPLY)) return;
        const resolve = this.waiting;
        this.waiting = null;
        resolve?.(JSON.parse(line.slice(RENDER_REPLY.length)));
      });
    this.child.on("close", (code) => {
      this.exited = new Error(`The indexer stopped (exit code ${code})`);
      const resolve = this.waiting;
      this.waiting = null;
      resolve?.(this.exited);
    });
    // The first reply says it is ready.
    this.queue = this.next();
    process.once("exit", () => this.close());
  }

  private next(): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (this.exited) return reject(this.exited);
      this.waiting = (reply) =>
        reply instanceof Error ? reject(reply) : resolve(reply);
    });
  }

  /** One request at a time, in the order they were made. */
  private request(body: object): Promise<Record<string, unknown>> {
    const run = this.queue
      .catch(() => {})
      .then(() => {
        const reply = this.next();
        this.child.stdin.write(JSON.stringify({ id: ++this.id, ...body }) + "\n");
        return reply;
      });
    this.queue = run.catch(() => {});
    return run;
  }

  async pages(): Promise<string[]> {
    const reply = await this.request({ pages: true });
    if (!reply.ok) throw new Error(String(reply.error));
    return reply.pages as string[];
  }

  async index(file: string): Promise<PageIndex | null> {
    const reply = await this.request({ file });
    if (!reply.ok) return null;
    return {
      searchDocuments: (reply.searchDocuments as any[]) || [],
      archiveIncludes:
        (reply.archiveIncludes as Record<string, ArchiveInclude[]>) || {},
      typstJobs: (reply.typstJobs as TypstJob[]) || [],
      typstDownloads: (reply.typstDownloads as string[]) || [],
    };
  }

  invalidate(): void {
    void this.request({ invalidate: true }).catch(() => {});
  }

  close(): void {
    this.child.kill();
  }
}

/**
 * Indexes with a renderer of this process, for when there is no bundle to
 * start a process from. A long page holds up the requests behind it.
 */
export class InProcessIndexer implements Indexer {
  constructor(
    private readonly renderer: () => PageRenderer,
    private readonly exclusive: <T>(run: () => Promise<T>) => Promise<T>,
  ) {}

  pages(): Promise<string[]> {
    return this.exclusive(() => this.renderer().pages());
  }

  index(file: string): Promise<PageIndex | null> {
    return this.exclusive(async () => {
      try {
        const { page } = await this.renderer().renderPage({ file });
        return page
          ? {
              searchDocuments: page.searchDocuments,
              archiveIncludes: page.archiveIncludes,
              typstJobs: page.typstJobs,
              typstDownloads: page.typstDownloads,
            }
          : null;
      } catch {
        return null;
      }
    });
  }

  invalidate(): void {
    // Shares the renderer, which the dev server invalidates itself.
  }

  close(): void {}
}
