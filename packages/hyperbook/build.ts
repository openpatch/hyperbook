import path, { posix } from "path";
import fs, { cp, mkdir } from "fs/promises";
import chalk from "chalk";
import readline from "readline";
import { hyperproject, vfile, hyperbook } from "@hyperbook/fs";
import { runArchive } from "./archive";
import { makeDir } from "./helpers/make-dir";
import { rimraf } from "rimraf";
import extractZip from "extract-zip";
import {
  Link,
  Hyperproject,
  HyperbookContext,
  Navigation,
} from "@hyperbook/types";
import lunr from "lunr";
import { process as hyperbookProcess } from "@hyperbook/markdown";
import packageJson from "./package.json";

export const ASSETS_FOLDER = "__hyperbook_assets";

export async function runBuildProject(
  project: Hyperproject,
  rootProject: Hyperproject,
  out?: string,
  filter?: string,
): Promise<void> {
  const name = hyperproject.getName(project);
  if (project.type === "book") {
    console.log(`${chalk.cyan(`[${name}]`)} Building Book.`);
    await runBuild(
      project.src,
      rootProject,
      project.basePath,
      name,
      out,
      filter,
    );
  } else {
    console.log(`${chalk.cyan(`[${name}]`)} Building Library.`);
    if (!out) {
      out = project.src;
    }
    await rimraf(path.join(out, ".hyperbook", "out"));
    for (const p of project.projects) {
      await runBuildProject(p, rootProject, out, filter);
    }
  }
}

async function runBuild(
  root: string,
  rootProject: Hyperproject,
  basePath?: string,
  prefix?: string,
  out?: string,
  filter?: string,
): Promise<void> {
  console.log(`${chalk.blue(`[${prefix}]`)} Reading hyperbook.json.`);
  const hyperbookJson = await hyperbook.getJson(root);

  if (!basePath && hyperbookJson?.basePath) {
    basePath = hyperbookJson.basePath;
  }

  if (basePath && !basePath.startsWith("/")) {
    basePath = "/" + basePath;
  }

  if (basePath && basePath.endsWith("/")) {
    basePath = basePath.slice(0, -1);
  }

  hyperbookJson.basePath = basePath;

  vfile.clean(root);

  let link: Link | undefined = undefined;
  if (rootProject.type === "library") {
    link = await hyperproject.getLink(rootProject, hyperbookJson.language);
  }
  if (link) {
    if (!hyperbookJson.links) {
      hyperbookJson.links = [link];
    } else {
      hyperbookJson.links.push(link);
    }
  }

  let rootOut = path.join(root, ".hyperbook", "out");
  if (out) {
    rootOut = path.join(out, ".hyperbook", "out", basePath || "");
  }
  console.log(
    `${chalk.blue(`[${prefix}]`)} Cleaning output folder ${rootOut}.`,
  );

  await runArchive(root, rootOut, prefix);

  // Helper function to resolve relative paths
  const resolveRelativePath = (
    path: string,
    currentPageHref: string,
  ): string => {
    // If path is absolute, return as-is
    if (path.startsWith("/")) {
      return path;
    }

    // Get the directory of the current page
    const currentPageDir = posix.dirname(currentPageHref);

    // Resolve the relative path and normalize
    return posix.normalize(posix.resolve(currentPageDir, path));
  };

  const baseCtx: Pick<
    HyperbookContext,
    "config" | "makeUrl" | "project" | "root"
  > = {
    root,
    config: hyperbookJson,
    makeUrl: (path, base, page) => {
      if (typeof path === "string") {
        // Handle absolute URLs
        if (path.includes("://") || path.startsWith("data:")) {
          return path;
        }

        if (path.endsWith(".md")) {
          path = path.slice(0, -3);
        } else if (path.endsWith(".md.json")) {
          path = path.slice(0, -8);
        } else if (path.endsWith(".md.yml")) {
          path = path.slice(0, -7);
        }

        // Handle relative paths when we have a current page context
        if (page?.href && !path.startsWith("/")) {
          path = resolveRelativePath(path, page.href);
        }

        path = [path];
      }

      // Handle array paths - resolve relative segments
      if (Array.isArray(path) && page?.href) {
        path = path.map((segment) => {
          if (typeof segment === "string" && !segment.startsWith("/")) {
            return resolveRelativePath(segment, page.href || "");
          }
          return segment;
        });
      }

      switch (base) {
        case "glossary":
          return posix.join("/", basePath || "", "glossary", ...path);
        case "book":
          return posix.join(basePath || "", ...path);
        case "public":
          return posix.join(basePath || "", ...path);
        case "archive":
          return posix.join("/", basePath || "", "archives", ...path);
        case "assets":
          if (path.length === 1 && path[0] === "/") {
            return `${posix.join("/", basePath || "", ASSETS_FOLDER, ...path)}`;
          } else {
            return `${posix.join("/", basePath || "", ASSETS_FOLDER, ...path)}?version=${packageJson.version}`;
          }
      }
    },
    project: rootProject,
  };

  const directives = new Set<string>([]);
  const pagesAndSections = await hyperbook.getPagesAndSections(root);
  const pageList = hyperbook.getPageList(
    pagesAndSections.sections,
    pagesAndSections.pages,
  );
  const searchDocuments: any[] = [];

  let bookFiles = await vfile.listForFolder(root, "book");
  if (filter) {
    bookFiles = bookFiles.filter((b) => b.path.absolute.endsWith(filter));
  }

  let i = 1;
  for (let file of bookFiles) {
    const n1 = await hyperbook.getNavigationForFile(pageList, file);
    const navigation: Navigation = {
      ...n1,
      ...pagesAndSections,
    };
    const ctx: HyperbookContext = {
      ...baseCtx,
      navigation,
    };
    const result = await hyperbookProcess(file.markdown.content, ctx);
    searchDocuments.push(...(result.data.searchDocuments || []));
    for (let directive of Object.keys(result.data.directives || {})) {
      directives.add(directive);
    }

    let directoryOut = path.join(rootOut, file.path.directory);
    let href: string;
    if (file.name === "index") {
      href = path.posix.join(file.path.href || "", "index.html");
    } else if (hyperbookJson.trailingSlash) {
      directoryOut = path.join(directoryOut, file.name);
      href = path.posix.join(file.path.href || "", "index.html");
    } else {
      href = file.path.href + ".html";
    }
    const fileOut = path.join(rootOut, href);
    await makeDir(directoryOut, {
      recursive: true,
    });
    if (file.markdown.data.permaid) {
      const permaOut = path.join(rootOut, "@");
      await makeDir(permaOut, {
        recursive: true,
      });
      const permaFileOut = path.join(
        permaOut,
        file.markdown.data.permaid + ".html",
      );
      await fs.writeFile(permaFileOut, result.value);
    }
    await fs.writeFile(fileOut, result.value);
    if (!process.env.CI) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Buildung book: [${i++}/${bookFiles.length}]`,
    );
    if (process.env.CI) {
      process.stdout.write("\n");
    }
  }
  process.stdout.write("\n");

  let glossaryFiles = await vfile.listForFolder(root, "glossary");
  const glossaryOut = path.join(rootOut, "glossary");
  if (filter) {
    glossaryFiles = glossaryFiles.filter((f) =>
      f.path.absolute?.endsWith(filter),
    );
  }

  i = 1;
  for (let file of glossaryFiles) {
    const n1 = await hyperbook.getNavigationForFile(pageList, file);
    const navigation: Navigation = {
      ...n1,
      ...pagesAndSections,
    };
    const ctx: HyperbookContext = {
      ...baseCtx,
      navigation,
    };
    const result = await hyperbookProcess(file.markdown.content, ctx);
    searchDocuments.push(...(result.data.searchDocuments || []));
    for (let directive of Object.keys(result.data.directives || {})) {
      directives.add(directive);
    }

    let href = file.path.href + ".html";
    let fileOut = path.join(rootOut, href);
    if (hyperbookJson.trailingSlash) {
      href = path.posix.join(file.path.href || "", "index.html");
      fileOut = path.join(rootOut, file.path.href || "", "index.html");
      await makeDir(path.join(rootOut, file.path.href || ""), {
        recursive: true,
      });
    } else {
      await makeDir(glossaryOut, {
        recursive: true,
      });
    }
    await fs.writeFile(fileOut, result.value);
    if (!process.env.CI) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Buildung glossary: [${i++}/${glossaryFiles.length}]`,
    );
    if (process.env.CI) {
      process.stdout.write("\n");
    }
  }
  process.stdout.write("\n");

  const assetsPath = path.join(__dirname, "assets");
  const assetsOut = path.join(rootOut, ASSETS_FOLDER);
  await mkdir(assetsOut, {
    recursive: true,
  });

  let otherFiles = await vfile.listForFolder(root, "public");
  let bookOtherFiles = await vfile.listForFolder(root, "book-public");
  let glossaryOtherFiles = await vfile.listForFolder(root, "glossary-public");
  i = 1;
  for (let file of [...otherFiles, ...bookOtherFiles, ...glossaryOtherFiles]) {
    const directoryOut = path.join(rootOut, file.path.directory);
    await makeDir(directoryOut, {
      recursive: true,
    });
    if (file.path.href && file.extension !== ".h5p") {
      const fileOut = path.join(rootOut, file.path.href);
      await cp(file.path.absolute, fileOut);
    } else if (file.path.href && file.extension === ".h5p") {
      const fileOut = path.join(rootOut, file.path.href);
      await extractZip(file.path.absolute, {
        dir: fileOut,
      });

      // Read and modify h5p.json to ensure MathDisplay dependency is present
      const h5pJsonPath = path.join(fileOut, "h5p.json");
      const h5pJson = JSON.parse(await fs.readFile(h5pJsonPath, "utf8"));

      // Check if H5P.MathDisplay dependency already exists
      const hasMathDisplay = h5pJson.preloadedDependencies?.some(
        (dep: any) => dep.machineName === "H5P.MathDisplay",
      );

      // Add MathDisplay dependency if not present
      if (!hasMathDisplay) {
        const mathDisplayDependency = {
          machineName: "H5P.MathDisplay",
          majorVersion: 1,
          minorVersion: 0,
        };

        // Initialize preloadedDependencies array if it doesn't exist
        if (!h5pJson.preloadedDependencies) {
          h5pJson.preloadedDependencies = [];
        }

        h5pJson.preloadedDependencies.push(mathDisplayDependency);

        // Write the modified h5p.json back to file
        await fs.writeFile(h5pJsonPath, JSON.stringify(h5pJson, null, 2));
      }

      const h5pLibraries = path.join(assetsOut, "directive-h5p", "libraries");
      await makeDir(h5pLibraries, { recursive: true });

      const files = await fs.readdir(fileOut);
      const libraryFolders = files.filter(
        (file) => !["content", "h5p.json"].includes(file),
      );
      for (const libraryFolder of libraryFolders) {
        await cp(
          path.join(fileOut, libraryFolder),
          path.join(h5pLibraries, libraryFolder),
          {
            recursive: true,
            force: true,
          },
        );
        await rimraf(path.join(fileOut, libraryFolder));
      }
    }
    if (!process.env.CI) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying public files: [${i++}/${otherFiles.length}]`,
    );
    if (process.env.CI) {
      process.stdout.write("\n");
    }
  }
  process.stdout.write("\n");

  i = 1;
  for (let directive of directives) {
    const assetsDirectivePath = path.join(assetsPath, `directive-${directive}`);
    const assetsDirectiveOut = path.join(assetsOut, `directive-${directive}`);
    if (!process.env.CI) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying directive assets: [${i++}/${directives.size}]`,
    );
    if (process.env.CI) {
      process.stdout.write("\n");
    }
    try {
      await fs.access(assetsDirectivePath);
      await mkdir(assetsDirectiveOut, {
        recursive: true,
      });
      await cp(assetsDirectivePath, assetsDirectiveOut, { recursive: true });
    } catch (e) {
      process.stdout.write("\n");
      process.stdout.write(
        `${chalk.red(`[${prefix}]`)} Failed copying directive assets: ${directive}`,
      );
      process.stdout.write("\n");
    }
  }
  process.stdout.write("\n");

  const mainAssets = await fs.readdir(assetsPath);
  i = 1;
  for (let asset of mainAssets) {
    const assetPath = path.join(assetsPath, asset);
    const assetOut = path.join(assetsOut, asset);
    if (!asset.startsWith("directive-")) {
      await cp(assetPath, assetOut, {
        recursive: true,
        filter: (src) => {
          if (src.includes("lunr-languages")) {
            return (
              hyperbookJson.language !== undefined &&
              hyperbookJson.language !== "en" &&
              (src.endsWith("lunr-languages") ||
                src.endsWith(`lunr.${hyperbookJson.language}.min.js`) ||
                src.endsWith(`lunr.stemmer.support.min.js`))
            );
          }
          return true;
        },
      });
    }
    if (!process.env.CI) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying hyperbook assets: [${i++}/${mainAssets.length}]`,
    );
    if (process.env.CI) {
      process.stdout.write("\n");
    }
  }
  process.stdout.write("\n");

  if (hyperbookJson.search) {
    const documents: Record<string, any> = {};
    console.log(`${chalk.blue(`[${prefix}]`)} Building search index`);

    let foundLanguage = false;
    if (hyperbookJson.language && hyperbookJson.language !== "en") {
      try {
        require("lunr-languages/lunr.stemmer.support.js")(lunr);
        require(`lunr-languages/lunr.${hyperbookJson.language}.js`)(lunr);
        foundLanguage = true;
      } catch (e) {
        console.log(
          `${chalk.yellow(`[${prefix}]`)} ${hyperbookJson.language} is no valid value for the lanuage key. See https://github.com/MihaiValentin/lunr-languages for possible values. Falling back to English.`,
        );
      }
    }
    const idx = lunr(function () {
      if (foundLanguage) {
        // @ts-ignore
        this.use(lunr[hyperbookJson.language]);
      }
      this.ref("href");
      this.field("description");
      this.field("keywords");
      this.field("heading");
      this.field("content");
      this.metadataWhitelist = ["position"];

      searchDocuments.forEach((doc) => {
        const href = baseCtx.makeUrl(doc.href, "book");
        const docWithBase = {
          ...doc,
          href,
        };
        this.add(docWithBase);
        documents[href] = docWithBase;
      });
    });

    const js = `
const LUNR_INDEX = ${JSON.stringify(idx)};
const SEARCH_DOCUMENTS = ${JSON.stringify(documents)};
`;

    await fs.writeFile(path.join(rootOut, ASSETS_FOLDER, "search.js"), js);
  }

  const supportLanguages = await fs
    .readdir(path.join(__dirname, "locales"))
    .then((files) => files.map((file) => file.split(".")[0]));
  let language = "en";
  if (
    hyperbookJson.language &&
    supportLanguages.includes(hyperbookJson.language)
  ) {
    language = hyperbookJson.language;
  }

  const i18nJS = await fs.readFile(
    path.join(rootOut, ASSETS_FOLDER, "i18n.js"),
    "utf-8",
  );
  const locales = await fs.readFile(
    path.join(__dirname, "locales", `${language}.json`),
    "utf-8",
  );
  await fs.writeFile(
    path.join(rootOut, ASSETS_FOLDER, "i18n.js"),
    i18nJS.replace(
      /\/\/[\s]*LOCALES[\s\S]*?[\s]*\/\/[\s]*LOCALES/g,
      `
  // GENERATED
  const locales = ${locales};
`,
    ),
  );

  console.log(`${chalk.green(`[${prefix}]`)} Build success: ${rootOut}`);
}
