import path from "path";
import fs from "fs";
import mime from "mime";
import { Hyperproject } from "@hyperbook/types";
import { IncrementalBuilder } from "./incremental";
import { AssetManager } from "./helpers/assets";

/** What a dev backend answers a request with. */
export type Served =
  | { status: number; type: string; body: string | Buffer }
  | { status: number; type: string; file: string };

export type FileEvent = "add" | "change" | "unlink";

/** How the dev server gets the book's output. */
export interface DevBackend {
  /** Gets the first output ready; a throw is a build error to show. */
  start(): Promise<void>;
  /**
   * Answers a request, `pathname` relative to the base path and without its
   * leading slash. Null: nothing here.
   */
  serve(pathname: string): Promise<Served | null>;
  /** Files changed: brings the output up to date, names the pages to reload. */
  change(files: [string, FileEvent][]): Promise<string[] | "*">;
  /** The author asked to rebuild everything. */
  rebuild(): Promise<void>;
}

/**
 * A hyperlibrary in the dev server: built in full up front and kept up to
 * date by the incremental builder. Books render page by page (dev-book.ts),
 * which hyperbook render does not do for a library's sub-books yet.
 */
export class LibraryBackend implements DevBackend {
  private readonly builder: IncrementalBuilder;
  private readonly outDir: string;
  /** Files a failed change never got to; they go first next time. */
  private leftover: [string, FileEvent][] = [];

  constructor(root: string, rootProject: Hyperproject, assets: AssetManager) {
    this.builder = new IncrementalBuilder(root, rootProject, assets);
    this.outDir = path.join(rootProject.src, ".hyperbook", "out");
  }

  start(): Promise<void> {
    return this.builder.initialize();
  }

  async serve(pathname: string): Promise<Served | null> {
    if (pathname.endsWith("/")) pathname += "index.html";
    for (const candidate of [
      pathname,
      pathname + ".html",
      path.join(pathname, "index.html"),
    ]) {
      const file = path.join(this.outDir, candidate);
      if (!file.startsWith(this.outDir)) return null;
      const stat = await fs.promises.stat(file).catch(() => null);
      if (stat?.isFile()) {
        return {
          status: 200,
          type: mime.getType(file) || "application/octet-stream",
          file,
        };
      }
    }
    return null;
  }

  async change(files: [string, FileEvent][]): Promise<string[] | "*"> {
    const queue = [...this.leftover];
    for (const [file, event] of files) {
      if (!queue.some(([queued]) => queued === file)) queue.push([file, event]);
    }
    this.leftover = [];

    let changed: string[] | "*" = [];
    for (let i = 0; i < queue.length; i++) {
      const [file, event] = queue[i];
      try {
        const result = await this.builder.handleChange(file, event);
        if (changed !== "*") {
          changed =
            result.changedPages === "*"
              ? "*"
              : [...new Set([...changed, ...result.changedPages])];
        }
      } catch (e) {
        // Whatever the failed file kept us from reaching would otherwise stay
        // stale until it is touched again.
        this.leftover = queue.slice(i + 1);
        throw e;
      }
    }
    return changed;
  }

  async rebuild(): Promise<void> {
    await this.builder.handleChange("hyperbook.json", "change");
  }
}
