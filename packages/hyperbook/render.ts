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
  writeI18n,
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

export class PageRenderer {
  private prepared = false;
  private copies = new Map<string, Promise<void>>();
  readonly rootOut: string;
  readonly assetsOut: string;

  constructor(
    private readonly root: string,
    private readonly rootProject: Hyperproject,
    private readonly assets = new AssetManager(),
  ) {
    this.rootOut = path.join(root, ".hyperbook", "out");
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
   * by its address (/a). Reads every file anew, so changes on disk show.
   */
  async render(target: { file?: string; href?: string }): Promise<RenderResult> {
    if (!this.prepared) await this.prepare();
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

    const bookFiles = await vfile.listForFolder(this.root, "book");
    const glossaryFiles = await vfile.listForFolder(this.root, "glossary");
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
    if (!page) return { ok: false, error: "There is no page here" };

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

    await Promise.all([
      ...result.directives.map((directive) =>
        this.once(`directive:${directive}`, () =>
          this.assets.copyDirective(
            directive,
            this.assetsOut,
            !!elementCdn(json, directive),
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
      ok: true,
      href,
      file: path.relative(this.root, page.path.absolute),
      out: path.relative(this.rootOut, outFile(page, json)),
    };
  }
}

/** Where buildSingle*Page wrote a page. */
function outFile(page: VFileBook | VFileGlossary, json: HyperbookJson): string {
  const rootOut = path.join(page.root, ".hyperbook", "out");
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
 */
export async function runRender(
  root: string,
  rootProject: Hyperproject,
  assets: AssetManager,
): Promise<void> {
  const renderer = new PageRenderer(root, rootProject, assets);
  await renderer.prepare();
  const reply = (data: object) =>
    process.stdout.write(RENDER_REPLY + JSON.stringify(data) + "\n");
  reply({ ready: true });

  const lines = readline.createInterface({ input: process.stdin });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let request: { id?: unknown; file?: unknown; href?: unknown };
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
      reply({ id: request.id, ...(await renderer.render(target)) });
    } catch (e) {
      reply({
        id: request.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
