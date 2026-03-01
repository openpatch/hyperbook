import path from "path";
import fs from "fs/promises";
import { cp } from "fs/promises";
import chalk from "chalk";
import { hyperproject, vfile, hyperbook, VFileBook, VFileGlossary } from "@hyperbook/fs";
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
} from "./build";

type ChangeType = "content-book" | "content-glossary" | "public" | "config" | "structural";

export class IncrementalBuilder {
  private root: string;
  private rootProject: Hyperproject;
  private hyperbookJson: HyperbookJson | null = null;
  private baseCtx: Pick<HyperbookContext, "config" | "makeUrl" | "project" | "root"> | null = null;
  private pagesAndSections: Pick<Navigation, "pages" | "sections" | "glossary"> | null = null;
  private pageList: HyperbookPage[] | null = null;
  private searchDocuments: Map<string, any[]> = new Map();
  private directives: Set<string> = new Set();
  private rootOut: string = "";
  private assetsOut: string = "";
  private initialized = false;

  // Track known files for structural change detection
  private knownBookFiles: Set<string> = new Set();
  private knownGlossaryFiles: Set<string> = new Set();

  constructor(root: string, rootProject: Hyperproject) {
    this.root = root;
    this.rootProject = rootProject;
  }

  async initialize(): Promise<void> {
    console.log(`${chalk.yellow("[Incremental]")} Full initial build...`);
    await runBuildProject(this.rootProject, this.rootProject);

    // Populate caches after full build
    await this.refreshCaches();
    this.initialized = true;
    console.log(`${chalk.green("[Incremental]")} Initial build complete. Incremental mode active.`);
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

    this.baseCtx = makeBaseCtx(this.root, this.hyperbookJson, basePath, this.rootProject);
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
    const bookFiles = await vfile.listForFolder(this.root, "book");
    for (const f of bookFiles) {
      this.knownBookFiles.add(f.path.absolute);
    }
    const glossaryFiles = await vfile.listForFolder(this.root, "glossary");
    for (const f of glossaryFiles) {
      this.knownGlossaryFiles.add(f.path.absolute);
    }
  }

  classifyChange(filePath: string, eventType: "add" | "change" | "unlink"): ChangeType {
    const absPath = path.resolve(this.root, filePath);

    // Config changes always trigger full rebuild
    if (filePath === "hyperbook.json" || filePath === "hyperlibrary.json") {
      return "config";
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
      const isMarkdown = filePath.endsWith(".md") || filePath.endsWith(".md.hbs") || filePath.endsWith(".md.json") || filePath.endsWith(".md.yml");
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
      await runBuildProject(this.rootProject, this.rootProject);
      await this.refreshCaches();
      return { changedPages: "*" };
    }

    const changeType = this.classifyChange(filePath, eventType);

    switch (changeType) {
      case "config":
      case "structural": {
        console.log(`${chalk.yellow("[Incremental]")} Structural change detected, full rebuild...`);
        vfile.clean(this.root);
        await runBuildProject(this.rootProject, this.rootProject);
        await this.refreshCaches();
        return { changedPages: "*" };
      }

      case "content-book": {
        console.log(`${chalk.yellow("[Incremental]")} Content change: ${filePath}`);
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
          console.log(`${chalk.yellow("[Incremental]")} Could not find changed file, full rebuild...`);
          await runBuildProject(this.rootProject, this.rootProject);
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

        // Update search documents cache
        this.searchDocuments.set(changedFile.path.href || changedFile.path.absolute, result.searchDocuments);
        for (const directive of result.directives) {
          this.directives.add(directive);
        }

        // Copy any new directive assets
        await this.copyDirectiveAssets(result.directives);

        const changedHref = changedFile.path.href || "/";
        console.log(`${chalk.green("[Incremental]")} Rebuilt: ${changedHref}`);
        return { changedPages: [changedHref] };
      }

      case "content-glossary": {
        console.log(`${chalk.yellow("[Incremental]")} Glossary change: ${filePath}`);
        vfile.clean(this.root);
        this.pagesAndSections = await hyperbook.getPagesAndSections(this.root);
        this.pageList = hyperbook.getPageList(
          this.pagesAndSections.sections,
          this.pagesAndSections.pages,
        );

        const glossaryFiles = await vfile.listForFolder(this.root, "glossary");
        const absPath = path.resolve(this.root, filePath);
        const changedFile = glossaryFiles.find((f) => f.path.absolute === absPath);

        if (!changedFile) {
          console.log(`${chalk.yellow("[Incremental]")} Could not find changed glossary file, full rebuild...`);
          await runBuildProject(this.rootProject, this.rootProject);
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

        this.searchDocuments.set(changedFile.path.href || changedFile.path.absolute, result.searchDocuments);
        for (const directive of result.directives) {
          this.directives.add(directive);
        }

        await this.copyDirectiveAssets(result.directives);

        const changedHref = changedFile.path.href || "/glossary";
        console.log(`${chalk.green("[Incremental]")} Rebuilt: ${changedHref}`);
        return { changedPages: [changedHref] };
      }

      case "public": {
        console.log(`${chalk.yellow("[Incremental]")} Public file change: ${filePath}`);
        const absPath = path.resolve(this.root, filePath);

        // Determine which public folder it belongs to and copy it
        const publicDirs = [
          { dir: path.join(this.root, "public"), folder: "public" as const },
          { dir: path.join(this.root, "book-public"), folder: "book-public" as const },
          { dir: path.join(this.root, "glossary-public"), folder: "glossary-public" as const },
        ];

        for (const { dir } of publicDirs) {
          if (absPath.startsWith(dir + path.sep)) {
            const relativePath = path.relative(dir, absPath);
            const destPath = path.join(this.rootOut, relativePath);
            const destDir = path.dirname(destPath);
            try {
              await fs.mkdir(destDir, { recursive: true });
              await cp(absPath, destPath);
              console.log(`${chalk.green("[Incremental]")} Copied: ${relativePath}`);
            } catch (e) {
              console.log(`${chalk.red("[Incremental]")} Failed to copy: ${relativePath}`);
            }
            break;
          }
        }

        // Public file changes affect all pages (images could be on any page)
        return { changedPages: "*" };
      }
    }
  }

  private async copyDirectiveAssets(newDirectives: string[]): Promise<void> {
    const assetsPath = path.join(__dirname, "assets");
    for (const directive of newDirectives) {
      const assetsDirectivePath = path.join(assetsPath, `directive-${directive}`);
      const assetsDirectiveOut = path.join(this.assetsOut, `directive-${directive}`);
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
