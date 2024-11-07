import path, { posix } from "path";
import fs, { cp, mkdir } from "fs/promises";
import chalk from "chalk";
import readline from "readline";
import { hyperproject, vfile, hyperbook } from "@hyperbook/fs";
import { runArchive } from "./archive";
import { makeDir } from "./helpers/make-dir";
import { rimraf } from "rimraf";
import {
  Link,
  Hyperproject,
  HyperbookContext,
  Navigation,
} from "@hyperbook/types";
import { process as hyperbookProcess } from "@hyperbook/markdown";

const ASSETS_FOLDER = "__hyperbook_assets";

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

  if (!out) {
    out = root;
  }
  let rootOut = path.join(out, ".hyperbook", "out", basePath || "");
  console.log(
    `${chalk.blue(`[${prefix}]`)} Cleaning output folder ${rootOut}.`,
  );

  await runArchive(root, rootOut, prefix);

  const baseCtx: Pick<
    HyperbookContext,
    "config" | "makeUrl" | "project" | "root"
  > = {
    root,
    config: hyperbookJson,
    makeUrl: (path, base) => {
      if (typeof path === "string") {
        if (path.includes("://")) {
          return path;
        }
        path = [path];
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
          return posix.join("/", basePath || "", ASSETS_FOLDER, ...path);
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
    for (let directive of Object.keys(result.data.directives || {})) {
      directives.add(directive);
    }

    const directoryOut = path.join(rootOut, file.path.directory);
    let href: string;
    if (file.path.directory === "") {
      href = "index.html";
    } else if (file.name === "index") {
      href = path.posix.join(file.path.href || "", "index.html");
    } else {
      href = file.path.href + ".html";
    }
    const fileOut = path.join(rootOut, href);
    await makeDir(directoryOut, {
      recursive: true,
    });
    await fs.writeFile(fileOut, result.value);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Buildung book: [${i++}/${bookFiles.length}]`,
    );
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
    for (let directive of Object.keys(result.data.directives || {})) {
      directives.add(directive);
    }

    const href = file.path.href + ".html";
    const fileOut = path.join(rootOut, href);
    await makeDir(glossaryOut, {
      recursive: true,
    });
    await fs.writeFile(fileOut, result.value);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Buildung glossary: [${i++}/${glossaryFiles.length}]`,
    );
  }
  process.stdout.write("\n");

  let otherFiles = await vfile.listForFolder(root, "public");
  i = 1;
  for (let file of otherFiles) {
    const directoryOut = path.join(rootOut, file.path.directory);
    await makeDir(directoryOut, {
      recursive: true,
    });
    if (file.path.href) {
      const fileOut = path.join(rootOut, file.path.href);
      await cp(file.path.absolute, fileOut);
    }
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying public files: [${i++}/${otherFiles.length}]`,
    );
  }
  process.stdout.write("\n");

  const assetsPath = path.join(__dirname, "assets");
  const assetsOut = path.join(rootOut, ASSETS_FOLDER);
  await mkdir(assetsOut, {
    recursive: true,
  });

  i = 1;
  for (let directive of directives) {
    const assetsDirectivePath = path.join(assetsPath, `directive-${directive}`);
    const assetsDirectiveOut = path.join(assetsOut, `directive-${directive}`);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying directive assets: [${i++}/${directives.size}]`,
    );
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
    }
  }
  process.stdout.write("\n");

  const mainAssets = await fs.readdir(assetsPath);
  i = 1;
  for (let asset of mainAssets) {
    const assetPath = path.join(assetsPath, asset);
    const assetOut = path.join(assetsOut, asset);
    const stat = await fs.stat(assetPath);
    if (stat.isFile()) {
      await cp(assetPath, assetOut, { recursive: true });
    }
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue(`[${prefix}]`)} Copying hyperbook assets: [${i++}/${mainAssets.length}]`,
    );
  }
  process.stdout.write("\n");

  console.log(`${chalk.green(`[${prefix}]`)} Build success: ${rootOut}`);
}
