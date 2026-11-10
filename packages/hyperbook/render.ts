import path from "path";
import fs from "fs/promises";
import { cp } from "fs/promises";
import readline from "readline";
import {
  hyperbook,
  vfile,
  getPasswords,
  VFileBook,
  VFileGlossary,
} from "@hyperbook/fs";
import { clearCollectedPasswords } from "@hyperbook/markdown";
import { elementCdn, Hyperproject, HyperbookJson } from "@hyperbook/types";
import { AssetManager } from "./helpers/assets";
import {
  ASSETS_FOLDER,
  buildSingleBookPage,
  buildSingleGlossaryPage,
  copyMainAssets,
  makeBaseCtx,
  hostedRuntimeFor,
  writeI18n,
  type SinglePageResult,
} from "./build";

/*
 * Renders single pages on request, for a preview that follows an editor:
 * no full build, just Hyperbook's own assets once and then each page as it
 * is asked for, with the element runtimes and emojis it uses. Files of the
 * book (public/, images next to pages) are not copied; whoever serves the
 * output serves them from the book's folder.
 */

export type RenderResult =
  | { ok: true; href: string; file: string; out: string }
  | { ok: false; error: string };

/** "/a/b/", "/a/b.html", "/a/b/index.html" → "/a/b"; "/" stays. */
export function normalizeHref(href: string): string {
  let h = href.split(/[?#]/)[0]!;
  h = h.replace(/\.html$/, "").replace(/\/index$/, "");
  h = h.replace(/\/+$/, "");
  return h === "" ? "/" : h;
}

/** What every page of a render is made with: the book as it was last read. */
type BookState = {
  json: HyperbookJson;
  baseCtx: ReturnType<typeof makeBaseCtx> & {
    passwords: Awaited<ReturnType<typeof getPasswords>>["passwords"];
  };
  pagesAndSections: Awaited<ReturnType<typeof hyperbook.getPagesAndSections>>;
  pageList: ReturnType<typeof hyperbook.getPageList>;
  bookFiles: VFileBook[];
  glossaryFiles: VFileGlossary[];
};

export class PageRenderer {
  private prepared = false;
  private copies = new Map<string, Promise<void>>();
  private state: BookState | null = null;
  readonly rootOut: string;
  readonly assetsOut: string;

  constructor(
    private readonly root: string,
    private readonly rootProject: Hyperproject,
    private readonly assets = new AssetManager(),
    /**
     * Keep what was read of the book (navigation, pages, settings) from one
     * render to the next until invalidate() is called. Reading it is most of
     * a render's time on a large book; the dev server watches the files and
     * knows when it goes stale. Without it every render reads the book anew,
     * for callers that change files without saying so (the cloud editor).
     */
    private readonly options: {
      keepBook?: boolean;
      /**
       * Render only for what pages contain (search documents, archive
       * includes): into a scratch folder beside the output, without
       * Hyperbook's assets or the elements' runtimes.
       */
      indexOnly?: boolean;
    } = {},
  ) {
    this.rootOut = path.join(
      root,
      ".hyperbook",
      options.indexOnly ? "index" : "out",
    );
    this.assetsOut = path.join(this.rootOut, ASSETS_FOLDER);
  }

  /** Reads hyperbook.json like a build does: basePath without slashes at the end. */
  private async config(): Promise<HyperbookJson> {
    const json = await hyperbook.getJson(this.root);
    let basePath = json.basePath;
    if (basePath && !basePath.startsWith("/")) basePath = "/" + basePath;
    if (basePath && basePath.endsWith("/")) basePath = basePath.slice(0, -1);
    json.basePath = basePath;
    return json;
  }

  /** Copies Hyperbook's own assets; pages render after this. */
  async prepare(): Promise<void> {
    const json = await this.config();
    await copyMainAssets(this.assetsOut, json);
    await writeI18n(this.assetsOut, json);
    // Pages load search.js when search is on; an empty index keeps them quiet.
    if (json.search) {
      await fs.writeFile(
        path.join(this.assetsOut, "search.js"),
        "export const LUNR_INDEX = null;\nexport const SEARCH_DOCUMENTS = [];\n",
      );
    }
    this.prepared = true;
  }

  /** The book changed on disk: the next render reads it anew. */
  invalidate(): void {
    this.state = null;
  }

  /** The book as the next render sees it. */
  async book(): Promise<BookState> {
    if (this.state && this.options.keepBook) return this.state;
    vfile.clean(this.root);
    clearCollectedPasswords(this.root);

    const json = await this.config();
    const { passwords } = await getPasswords(this.root, json, { reload: true });
    const baseCtx = {
      ...makeBaseCtx(this.root, json, json.basePath, this.rootProject),
      passwords,
    };
    const pagesAndSections = await hyperbook.getPagesAndSections(this.root);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    this.state = {
      json,
      baseCtx,
      pagesAndSections,
      pageList,
      bookFiles: await vfile.listForFolder(this.root, "book"),
      glossaryFiles: await vfile.listForFolder(this.root, "glossary"),
    };
    return this.state;
  }

  /** Every page of the book, by its file relative to the book. */
  async pages(): Promise<string[]> {
    const { bookFiles, glossaryFiles } = await this.book();
    return [...bookFiles, ...glossaryFiles].map((f) =>
      path.relative(this.root, f.path.absolute),
    );
  }

  private once(key: string, copy: () => Promise<void>): Promise<void> {
    let running = this.copies.get(key);
    if (!running) {
      running = copy();
      this.copies.set(key, running);
      running.catch(() => this.copies.delete(key));
    }
    return running;
  }

  /**
   * Renders one page, named by its file relative to the book (book/a.md) or
   * by its address (/a). Reads every file anew, so changes on disk show
   * (unless the book is kept, see the constructor).
   */
  async render(target: { file?: string; href?: string }): Promise<RenderResult> {
    return (await this.renderPage(target)).result;
  }

  /** Like render, with everything the page produced besides its HTML. */
  async renderPage(target: {
    file?: string;
    href?: string;
  }): Promise<{ result: RenderResult; page?: SinglePageResult }> {
    if (!this.prepared && !this.options.indexOnly) await this.prepare();
    const { json, baseCtx, pagesAndSections, pageList, bookFiles, glossaryFiles } =
      await this.book();

    let page: VFileBook | VFileGlossary | undefined;
    if (target.file) {
      const absolute = path.resolve(this.root, target.file);
      page =
        bookFiles.find((f) => f.path.absolute === absolute) ??
        glossaryFiles.find((f) => f.path.absolute === absolute);
    } else if (target.href) {
      const href = normalizeHref(target.href);
      page =
        bookFiles.find((f) => normalizeHref(f.path.href || "/") === href) ??
        glossaryFiles.find(
          (f) => normalizeHref(f.path.href || "/glossary") === href,
        );
    }
    if (!page) return { result: { ok: false, error: "There is no page here" } };

    const result =
      page.folder === "glossary"
        ? await buildSingleGlossaryPage(
            page as VFileGlossary,
            baseCtx,
            pageList,
            pagesAndSections,
            this.rootOut,
            this.assetsOut,
            json,
          )
        : await buildSingleBookPage(
            page as VFileBook,
            baseCtx,
            pageList,
            pagesAndSections,
            this.rootOut,
            this.assetsOut,
            json,
          );

    if (this.options.indexOnly) {
      return {
        result: {
          ok: true,
          href: page.path.href || (page.folder === "glossary" ? "/glossary" : "/"),
          file: path.relative(this.root, page.path.absolute),
          out: path.relative(this.rootOut, outFile(page, json, this.rootOut)),
        },
        page: result,
      };
    }

    await Promise.all([
      ...result.directives.map((directive) =>
        this.once(`directive:${directive}`, () =>
          this.assets.copyDirective(
            directive,
            this.assetsOut,
            !!elementCdn(json, directive, hostedRuntimeFor(directive)),
          ),
        ),
      ),
      ...result.emojis.map((emoji) =>
        this.once(`emoji:${emoji}`, async () => {
          const emojiOut = path.join(this.assetsOut, "emoji");
          await fs.mkdir(emojiOut, { recursive: true });
          await cp(
            path.join(__dirname, "assets", "emoji", `${emoji}.svg`),
            path.join(emojiOut, `${emoji}.svg`),
          ).catch(() => {
            // An emoji without an image.
          });
        }),
      ),
    ]);

    const href =
      page.path.href || (page.folder === "glossary" ? "/glossary" : "/");
    return {
      result: {
        ok: true,
        href,
        file: path.relative(this.root, page.path.absolute),
        out: path.relative(this.rootOut, outFile(page, json, this.rootOut)),
      },
      page: result,
    };
  }
}

/** Where buildSingle*Page wrote a page. */
function outFile(
  page: VFileBook | VFileGlossary,
  json: HyperbookJson,
  rootOut: string,
): string {
  const href = page.path.href || "";
  if (page.name === "index" || json.trailingSlash) {
    return path.join(rootOut, href, "index.html");
  }
  return path.join(rootOut, href + ".html");
}

/** Marks the lines on stdout that answer a request; everything else is log. */
export const RENDER_REPLY = "@hyperbook-render ";

/**
 * `hyperbook render`: reads requests from stdin, one JSON object per line
 * ({"id": 1, "file": "book/a.md"} or {"id": 2, "href": "/a"}), renders them
 * one after the other and answers each with a line RENDER_REPLY + JSON.
 *
 * With `index`, it is the dev server's indexer: it renders into a scratch
 * folder, keeps the book read until {"invalidate": true}, lists the pages for
 * {"pages": true}, and answers a render with what the page put in the search
 * index and the archives instead of its output.
 */
export async function runRender(
  root: string,
  rootProject: Hyperproject,
  assets: AssetManager,
  { index = false }: { index?: boolean } = {},
): Promise<void> {
  const renderer = new PageRenderer(root, rootProject, assets, {
    keepBook: index,
    indexOnly: index,
  });
  if (!index) await renderer.prepare();
  const reply = (data: object) =>
    process.stdout.write(RENDER_REPLY + JSON.stringify(data) + "\n");
  reply({ ready: true });

  const lines = readline.createInterface({ input: process.stdin });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let request: {
      id?: unknown;
      file?: unknown;
      href?: unknown;
      pages?: unknown;
      invalidate?: unknown;
    };
    try {
      request = JSON.parse(line);
    } catch {
      reply({ ok: false, error: "Not JSON" });
      continue;
    }
    const target = {
      file: typeof request.file === "string" ? request.file : undefined,
      href: typeof request.href === "string" ? request.href : undefined,
    };
    try {
      if (index && request.invalidate) {
        renderer.invalidate();
        reply({ id: request.id, ok: true });
      } else if (index && request.pages) {
        reply({ id: request.id, ok: true, pages: await renderer.pages() });
      } else if (index) {
        const { result, page } = await renderer.renderPage(target);
        reply({
          id: request.id,
          ...result,
          searchDocuments: page?.searchDocuments,
          archiveIncludes: page?.archiveIncludes,
          typstJobs: page?.typstJobs,
          typstDownloads: page?.typstDownloads,
        });
      } else {
        // A host serving the page builds its Typst documents (Hyperbook
        // Cloud's preview) and keeps undownloaded `.typ` sources private.
        const { result, page } = await renderer.renderPage(target);
        reply({
          id: request.id,
          ...result,
          ...(result.ok
            ? { typstJobs: page?.typstJobs ?? [], typstDownloads: page?.typstDownloads ?? [] }
            : {}),
        });
      }
    } catch (e) {
      reply({
        id: request.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
