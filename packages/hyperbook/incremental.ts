import path from "path";
import fs from "fs/promises";
import { cp } from "fs/promises";
import chalk from "chalk";
import {
  hyperproject,
  vfile,
  hyperbook,
  VFileBook,
  VFileGlossary,
} from "@hyperbook/fs";
import {
  Hyperproject,
  HyperbookContext,
  HyperbookJson,
  HyperbookPage,
  Navigation,
} from "@hyperbook/types";
import {
  ASSETS_FOLDER,
  buildSingleBookPage,
  buildSingleGlossaryPage,
  makeBaseCtx,
  runBuildProject,
  writeSearchIndex,
} from "./build";

type ChangeType =
  | "content-book"
  | "content-glossary"
  | "public"
  | "config"
  | "structural"
  // A file inlined into one or more pages: those pages have to be rebuilt.
  | "dependency";

export class IncrementalBuilder {
  private root: string;
  private rootProject: Hyperproject;
  private hyperbookJson: HyperbookJson | null = null;
  private baseCtx: Pick<
    HyperbookContext,
    "config" | "makeUrl" | "project" | "root" | "version"
  > | null = null;
  private pagesAndSections: Pick<
    Navigation,
    "pages" | "sections" | "glossary"
  > | null = null;
  private pageList: HyperbookPage[] | null = null;
  private searchDocuments: Map<string, any[]> = new Map();
  private directives: Set<string> = new Set();
  private rootOut: string = "";
  private assetsOut: string = "";
  private initialized = false;

  // Track known files for structural change detection
  private knownBookFiles: Set<string> = new Set();
  private knownGlossaryFiles: Set<string> = new Set();

  // Reverse dependency index: inlined file -> pages that inlined it. Built from
  // what each page actually read, so a change maps to the pages it can affect
  // rather than to a guess based on the file's folder.
  private dependents: Map<string, Set<string>> = new Map();
  // Page absolute path -> the file it was built from, to rebuild by dependency.
  private bookFileByPath: Map<string, VFileBook> = new Map();
  private glossaryFileByPath: Map<string, VFileGlossary> = new Map();
  // Nav-relevant shape of the last build, to notice when every page goes stale.
  private navigationFingerprint = "";

  constructor(root: string, rootProject: Hyperproject) {
    this.root = root;
    this.rootProject = rootProject;
  }

  async initialize(): Promise<void> {
    console.log(`${chalk.yellow("[Incremental]")} Full initial build...`);
    await this.fullRebuild();

    // Populate caches after full build
    await this.refreshCaches();
    this.initialized = true;
    console.log(
      `${chalk.green("[Incremental]")} Initial build complete. Incremental mode active.`,
    );
  }

  /**
   * Full rebuild that also repopulates the dependency graph and the cached
   * search documents, so incremental updates afterwards start from the truth.
   */
  private async fullRebuild(): Promise<void> {
    this.dependents.clear();
    this.searchDocuments.clear();
    await runBuildProject(
      this.rootProject,
      this.rootProject,
      undefined,
      undefined,
      (href, result) => {
        this.recordPageResult(href, result);
      },
    );
  }

  /** Indexes one page's dependencies and search documents. */
  private recordPageResult(
    href: string,
    result: { dependencies: string[]; searchDocuments: any[] },
  ): void {
    // Drop stale edges first: a page that no longer uses a file must not keep
    // being rebuilt when that file changes.
    for (const pages of this.dependents.values()) {
      pages.delete(href);
    }
    for (const dependency of result.dependencies) {
      let pages = this.dependents.get(dependency);
      if (!pages) {
        pages = new Set();
        this.dependents.set(dependency, pages);
      }
      pages.add(href);
    }
    this.searchDocuments.set(href, result.searchDocuments);
  }

  /**
   * Everything that is baked into every page's HTML — the sidebar, page order,
   * titles. When this changes, one rebuilt page is not enough.
   */
  private computeNavigationFingerprint(): string {
    return JSON.stringify({
      sections: this.pagesAndSections?.sections ?? [],
      pages: this.pagesAndSections?.pages ?? [],
    });
  }

  private async refreshCaches(): Promise<void> {
    const project = this.rootProject;
    if (project.type !== "book") {
      // For libraries, we don't support incremental — always full rebuild
      return;
    }

    this.hyperbookJson = await hyperbook.getJson(this.root);
    let basePath = project.basePath;

    if (!basePath && this.hyperbookJson?.basePath) {
      basePath = this.hyperbookJson.basePath;
    }
    if (basePath && !basePath.startsWith("/")) {
      basePath = "/" + basePath;
    }
    if (basePath && basePath.endsWith("/")) {
      basePath = basePath.slice(0, -1);
    }
    this.hyperbookJson.basePath = basePath;

    this.baseCtx = makeBaseCtx(
      this.root,
      this.hyperbookJson,
      basePath,
      this.rootProject,
    );
    this.pagesAndSections = await hyperbook.getPagesAndSections(this.root);
    this.pageList = hyperbook.getPageList(
      this.pagesAndSections.sections,
      this.pagesAndSections.pages,
    );

    this.rootOut = path.join(this.root, ".hyperbook", "out");
    this.assetsOut = path.join(this.rootOut, ASSETS_FOLDER);

    // Track known files
    this.knownBookFiles.clear();
    this.knownGlossaryFiles.clear();
    this.bookFileByPath.clear();
    this.glossaryFileByPath.clear();
    const bookFiles = await vfile.listForFolder(this.root, "book");
    for (const f of bookFiles) {
      this.knownBookFiles.add(f.path.absolute);
      this.bookFileByPath.set(f.path.absolute, f);
    }
    const glossaryFiles = await vfile.listForFolder(this.root, "glossary");
    for (const f of glossaryFiles) {
      this.knownGlossaryFiles.add(f.path.absolute);
      this.glossaryFileByPath.set(f.path.absolute, f);
    }

    this.navigationFingerprint = this.computeNavigationFingerprint();
  }

  classifyChange(
    filePath: string,
    eventType: "add" | "change" | "unlink",
  ): ChangeType {
    const absPath = path.resolve(this.root, filePath);

    // Config changes always trigger full rebuild
    if (filePath === "hyperbook.json" || filePath === "hyperlibrary.json") {
      return "config";
    }

    // A file some page inlined — rebuild those pages, whatever folder it is in.
    // Checked before the folder rules, because a `src=` target usually lives in
    // public/ or book/ and would otherwise be treated as a plain asset.
    if (this.dependents.get(absPath)?.size) {
      return "dependency";
    }

    // Public file changes (check before structural to avoid unnecessary full rebuilds)
    const publicDir = path.join(this.root, "public");
    const bookPublicDir = path.join(this.root, "book-public");
    const glossaryPublicDir = path.join(this.root, "glossary-public");
    if (
      absPath.startsWith(publicDir + path.sep) ||
      absPath.startsWith(bookPublicDir + path.sep) ||
      absPath.startsWith(glossaryPublicDir + path.sep)
    ) {
      return "public";
    }

    // File add/delete is structural (affects navigation)
    if (eventType === "add" || eventType === "unlink") {
      return "structural";
    }

    // Content changes to book files
    const bookDir = path.join(this.root, "book");
    if (absPath.startsWith(bookDir + path.sep) || absPath === bookDir) {
      const isMarkdown =
        filePath.endsWith(".md") ||
        filePath.endsWith(".md.hbs") ||
        filePath.endsWith(".md.json") ||
        filePath.endsWith(".md.yml");
      if (isMarkdown) {
        return "content-book";
      }
      return "public";
    }

    // Content changes to glossary files
    const glossaryDir = path.join(this.root, "glossary");
    if (absPath.startsWith(glossaryDir + path.sep) || absPath === glossaryDir) {
      return "content-glossary";
    }

    // Template/snippet changes or anything else → structural (full rebuild)
    return "structural";
  }

  async handleChange(
    filePath: string,
    eventType: "add" | "change" | "unlink",
  ): Promise<{ changedPages: string[] | "*" }> {
    if (!this.initialized || this.rootProject.type !== "book") {
      // Fall back to full rebuild for libraries or uninitialized state
      await this.fullRebuild();
      await this.refreshCaches();
      return { changedPages: "*" };
    }

    const changeType = this.classifyChange(filePath, eventType);

    switch (changeType) {
      case "config":
      case "structural": {
        console.log(
          `${chalk.yellow("[Incremental]")} Structural change detected, full rebuild...`,
        );
        vfile.clean(this.root);
        await this.fullRebuild();
        await this.refreshCaches();
        return { changedPages: "*" };
      }

      case "dependency": {
        const absPath = path.resolve(this.root, filePath);
        const pages = [...(this.dependents.get(absPath) || [])];
        console.log(
          `${chalk.yellow("[Incremental]")} Dependency change: ${filePath} -> ${pages.length} page(s)`,
        );

        // The file itself may also be a served asset (a `src=` script under
        // public/ is both inlined and downloadable), so copy it as well.
        await this.copyIfPublic(filePath);

        vfile.clean(this.root);
        await this.refreshCaches();

        const rebuilt: string[] = [];
        for (const href of pages) {
          const file =
            [...this.bookFileByPath.values()].find(
              (f) => (f.path.href || "/") === href,
            ) ||
            [...this.glossaryFileByPath.values()].find(
              (f) => (f.path.href || "/glossary") === href,
            );
          if (!file) continue;
          const result = await this.rebuildPage(file.path.absolute);
          if (result) rebuilt.push(result);
        }

        await this.refreshSearchIndex();
        console.log(
          `${chalk.green("[Incremental]")} Rebuilt: ${rebuilt.join(", ") || "nothing"}`,
        );
        return { changedPages: rebuilt };
      }

      case "content-book": {
        console.log(
          `${chalk.yellow("[Incremental]")} Content change: ${filePath}`,
        );
        // Clear vfile cache so it re-reads the changed file
        vfile.clean(this.root);
        // Refresh navigation (fast — reads frontmatter only)
        this.pagesAndSections = await hyperbook.getPagesAndSections(this.root);
        this.pageList = hyperbook.getPageList(
          this.pagesAndSections.sections,
          this.pagesAndSections.pages,
        );

        const bookFiles = await vfile.listForFolder(this.root, "book");
        const absPath = path.resolve(this.root, filePath);
        const changedFile = bookFiles.find((f) => f.path.absolute === absPath);

        if (!changedFile) {
          console.log(
            `${chalk.yellow("[Incremental]")} Could not find changed file, full rebuild...`,
          );
          await this.fullRebuild();
          await this.refreshCaches();
          return { changedPages: "*" };
        }

        const result = await buildSingleBookPage(
          changedFile,
          this.baseCtx!,
          this.pageList,
          this.pagesAndSections,
          this.rootOut,
          this.assetsOut,
          this.hyperbookJson!,
        );

        // Reindex, so a page that dropped a `src=` or a snippet stops being
        // rebuilt when that file changes.
        this.recordPageResult(changedFile.path.href || "/", result);
        for (const directive of result.directives) {
          this.directives.add(directive);
        }

        // Copy any new directive assets
        await this.copyDirectiveAssets(result.directives);

        const changedHref = changedFile.path.href || "/";

        // The sidebar is baked into every page, so a rename or reorder makes
        // all of them stale — rebuilding just this one would leave the rest
        // showing the old title.
        const nextFingerprint = this.computeNavigationFingerprint();
        if (nextFingerprint !== this.navigationFingerprint) {
          console.log(
            `${chalk.yellow("[Incremental]")} Navigation changed, rebuilding all pages...`,
          );
          this.navigationFingerprint = nextFingerprint;
          for (const absolute of this.bookFileByPath.keys()) {
            if (absolute === absPath) continue;
            await this.rebuildPage(absolute);
          }
          for (const absolute of this.glossaryFileByPath.keys()) {
            await this.rebuildPage(absolute);
          }
          await this.refreshSearchIndex();
          return { changedPages: "*" };
        }

        await this.refreshSearchIndex();
        console.log(`${chalk.green("[Incremental]")} Rebuilt: ${changedHref}`);
        return { changedPages: [changedHref] };
      }

      case "content-glossary": {
        console.log(
          `${chalk.yellow("[Incremental]")} Glossary change: ${filePath}`,
        );
        vfile.clean(this.root);
        this.pagesAndSections = await hyperbook.getPagesAndSections(this.root);
        this.pageList = hyperbook.getPageList(
          this.pagesAndSections.sections,
          this.pagesAndSections.pages,
        );

        const glossaryFiles = await vfile.listForFolder(this.root, "glossary");
        const absPath = path.resolve(this.root, filePath);
        const changedFile = glossaryFiles.find(
          (f) => f.path.absolute === absPath,
        );

        if (!changedFile) {
          console.log(
            `${chalk.yellow("[Incremental]")} Could not find changed glossary file, full rebuild...`,
          );
          await this.fullRebuild();
          await this.refreshCaches();
          return { changedPages: "*" };
        }

        const result = await buildSingleGlossaryPage(
          changedFile,
          this.baseCtx!,
          this.pageList,
          this.pagesAndSections,
          this.rootOut,
          this.assetsOut,
          this.hyperbookJson!,
        );

        this.recordPageResult(changedFile.path.href || "/glossary", result);
        for (const directive of result.directives) {
          this.directives.add(directive);
        }

        await this.copyDirectiveAssets(result.directives);

        const changedHref = changedFile.path.href || "/glossary";
        await this.refreshSearchIndex();
        console.log(`${chalk.green("[Incremental]")} Rebuilt: ${changedHref}`);
        return { changedPages: [changedHref] };
      }

      case "public": {
        console.log(
          `${chalk.yellow("[Incremental]")} Public file change: ${filePath}`,
        );
        await this.copyIfPublic(filePath);

        // No page inlined this file — it is a plain asset, so nothing needs
        // rebuilding, but any page could embed it, so reload everything.
        return { changedPages: "*" };
      }
    }
  }

  /** Copies a changed file to the output if it lives in a public folder. */
  private async copyIfPublic(filePath: string): Promise<void> {
    const absPath = path.resolve(this.root, filePath);
    const publicDirs = [
      path.join(this.root, "public"),
      path.join(this.root, "book-public"),
      path.join(this.root, "glossary-public"),
    ];
    for (const dir of publicDirs) {
      if (!absPath.startsWith(dir + path.sep)) continue;
      const relativePath = path.relative(dir, absPath);
      const destPath = path.join(this.rootOut, relativePath);
      try {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await cp(absPath, destPath);
        console.log(`${chalk.green("[Incremental]")} Copied: ${relativePath}`);
      } catch (e) {
        console.log(
          `${chalk.red("[Incremental]")} Failed to copy: ${relativePath}`,
        );
      }
      return;
    }
  }

  /** Rebuilds one book or glossary page and reindexes what it consumed. */
  private async rebuildPage(absPath: string): Promise<string | null> {
    const bookFile = this.bookFileByPath.get(absPath);
    if (bookFile) {
      const result = await buildSingleBookPage(
        bookFile,
        this.baseCtx!,
        this.pageList!,
        this.pagesAndSections!,
        this.rootOut,
        this.assetsOut,
        this.hyperbookJson!,
      );
      const href = bookFile.path.href || "/";
      this.recordPageResult(href, result);
      for (const directive of result.directives) {
        this.directives.add(directive);
      }
      await this.copyDirectiveAssets(result.directives);
      return href;
    }

    const glossaryFile = this.glossaryFileByPath.get(absPath);
    if (glossaryFile) {
      const result = await buildSingleGlossaryPage(
        glossaryFile,
        this.baseCtx!,
        this.pageList!,
        this.pagesAndSections!,
        this.rootOut,
        this.assetsOut,
        this.hyperbookJson!,
      );
      const href = glossaryFile.path.href || "/glossary";
      this.recordPageResult(href, result);
      for (const directive of result.directives) {
        this.directives.add(directive);
      }
      await this.copyDirectiveAssets(result.directives);
      return href;
    }

    return null;
  }

  /** Rewrites search.js from the cached per-page documents. */
  private async refreshSearchIndex(): Promise<void> {
    if (!this.hyperbookJson?.search) return;
    const all: any[] = [];
    for (const docs of this.searchDocuments.values()) {
      all.push(...docs);
    }
    await writeSearchIndex(
      this.hyperbookJson,
      this.baseCtx!,
      all,
      this.rootOut,
      "Incremental",
    );
  }

  private async copyDirectiveAssets(newDirectives: string[]): Promise<void> {
    const assetsPath = path.join(__dirname, "assets");
    for (const directive of newDirectives) {
      const assetsDirectivePath = path.join(
        assetsPath,
        `directive-${directive}`,
      );
      const assetsDirectiveOut = path.join(
        this.assetsOut,
        `directive-${directive}`,
      );
      try {
        await fs.access(assetsDirectivePath);
        await fs.mkdir(assetsDirectiveOut, { recursive: true });
        await cp(assetsDirectivePath, assetsDirectiveOut, { recursive: true });
      } catch {
        // Directive has no assets or already copied
      }
    }
  }
}
