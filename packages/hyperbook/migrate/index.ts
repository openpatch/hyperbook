import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { execSync } from "child_process";
import { VFile } from "vfile";
import {
  getPasswords,
  hyperbook,
  hyperproject,
  vfile,
  VFileBook,
  VFileGlossary,
} from "@hyperbook/fs";
import { HyperbookContext, Hyperproject, Navigation } from "@hyperbook/types";
import { legacyP5Ids, remark } from "@hyperbook/markdown";
import { makeBaseCtx } from "../build";
import { applyEdits, blankFrontmatter, Edit, Note } from "./edits";
import {
  convertSnippetAtLines,
  MdNode,
  migrateIdes,
  RULES,
  snippetUses,
} from "./ide";

export interface MigrateOptions {
  /** Print what would change without writing. */
  dryRun?: boolean;
  /** Run even though the project has uncommitted changes. */
  force?: boolean;
}

export interface FileResult {
  file: string;
  migrated: number;
  notes: Note[];
  before: string;
  after: string;
}

type ResolvedId = { name: string; start: number; end: number; id: string };

/**
 * The ids the page's directives get when it is built as it is now, with the
 * source range of each. Running the real pipeline is the only way to get
 * exactly the id readers' saved work is stored under: templates, snippets
 * and every plugin before the directive shape the node that is hashed.
 */
const resolvedIds = async (
  content: string,
  ctx: HyperbookContext,
): Promise<ResolvedId[]> => {
  const processor = remark(ctx);
  const file = new VFile({ value: content });
  await processor.run(processor.parse(file), file);
  // Typed in @hyperbook/markdown's DataMap, which this package does not see.
  const ids = (file.data as { resolvedDirectiveIds?: ResolvedId[] })
    .resolvedDirectiveIds || [];
  // p5 ids used to be derived at the rehype stage, from a different node.
  return [
    ...ids.filter((entry) => entry.name !== "p5"),
    ...(content.includes("p5") ? await legacyP5Ids(content, ctx) : []),
  ];
};

/**
 * Migrates one page's source. `processed` is the page as the build sees it
 * (templates rendered, front matter stripped); the old ids come from there and
 * are matched to the source by the directive's text.
 */
export const migrateSource = (
  source: string,
  ids: ResolvedId[],
  processed: string,
  ctx: HyperbookContext,
): {
  after: string;
  migrated: number;
  notes: Note[];
  uses: { name: string; inside: string }[];
} => {
  const tree = remark(ctx).parse(blankFrontmatter(source)) as unknown as MdNode;
  const used = new Set<number>();
  const oldId = (name: string, start: number, end: number) => {
    const text = source.slice(start, end);
    const index = ids.findIndex(
      (entry, i) =>
        !used.has(i) &&
        entry.name === name &&
        processed.slice(entry.start, entry.end) === text,
    );
    if (index === -1) return undefined;
    used.add(index);
    return ids[index].id;
  };

  const { edits, notes, migrated } = migrateIdes(tree, { source, oldId });
  return {
    after: applyEdits(source, edits as Edit[]),
    migrated,
    notes,
    uses: snippetUses(tree),
  };
};

const isDirty = (root: string): boolean => {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    return false; // not a git repository: nothing to compare against
  }
  const status = execSync("git status --porcelain -- .", {
    cwd: root,
    encoding: "utf8",
  });
  return status.trim().length > 0;
};

async function migrateBook(project: Hyperproject): Promise<FileResult[]> {
  const root = project.src;
  const hyperbookJson = await hyperbook.getJson(root);
  const { passwords } = await getPasswords(root, hyperbookJson);
  const baseCtx = {
    ...makeBaseCtx(root, hyperbookJson, undefined, project),
    passwords,
  };
  const pagesAndSections = await hyperbook.getPagesAndSections(root);
  const pageList = hyperbook.getPageList(
    pagesAndSections.sections,
    pagesAndSections.pages,
  );

  const files: (VFileBook | VFileGlossary)[] = [
    ...(await vfile.listForFolder(root, "book")),
    ...(await vfile.listForFolder(root, "glossary")),
  ];

  const results: FileResult[] = [];
  const uses: { name: string; inside: string }[] = [];
  for (const file of files) {
    if (!file.path.absolute.match(/\.md(\.hbs)?$/)) continue;
    const source = await fs.readFile(file.path.absolute, "utf8");
    const mentionsIde = Object.keys(RULES).some((name) => source.includes(name));
    if (!mentionsIde && !source.includes("snippet")) continue;

    const navigation: Navigation = {
      ...(await hyperbook.getNavigationForFile(pageList, file)),
      ...pagesAndSections,
    };
    const ctx: HyperbookContext = {
      ...baseCtx,
      navigation,
      dependencies: new Set(),
    };
    if (source.includes("snippet")) {
      uses.push(...migrateSource(source, [], source, ctx).uses);
    }
    if (!mentionsIde) continue;
    const ids = await resolvedIds(file.markdown.content, ctx);
    const { after, migrated, notes } = migrateSource(
      source,
      ids,
      file.markdown.content,
      ctx,
    );
    if (migrated === 0 && notes.length === 0) continue;
    results.push({
      file: path.relative(process.cwd(), file.path.absolute),
      migrated,
      notes,
      before: source,
      after,
    });
  }
  results.push(...(await migrateSnippets(root, baseCtx, uses)));
  return results;
}

/** Every file below a folder, or none when it does not exist. */
const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else files.push(full);
  }
  return files;
};

/** The IDEs whose old file lines a snippet may hold. */
const FILE_LINE_IDES = new Set(["typst", "openscad"]);

/**
 * Snippets are pasted into pages, so they can hold IDE directives or, more
 * often, the old @file/@font lines a page pastes into an IDE. Those lines are
 * only converted when every page pastes the snippet into a typst or openscad
 * block: the Online IDE still reads @file lines.
 *
 * IDEs inside snippets cannot have their ids pinned, because a snippet's
 * directives get their ids on the page they are used on.
 */
async function migrateSnippets(
  root: string,
  baseCtx: Omit<HyperbookContext, "navigation">,
  uses: { name: string; inside: string }[],
): Promise<FileResult[]> {
  const results: FileResult[] = [];
  const ctx: HyperbookContext = {
    ...baseCtx,
    navigation: {
      current: null,
      next: null,
      previous: null,
      pages: [],
      sections: [],
      glossary: [],
    },
  };
  const snippetsDir = path.join(root, "snippets");
  for (const absolute of await listFiles(snippetsDir)) {
    if (!absolute.match(/\.(md|hbs)$/)) continue;
    const source = await fs.readFile(absolute, "utf8");
    const name = path
      .relative(snippetsDir, absolute)
      .split(path.sep)
      .join("/")
      .replace(/\.md\.hbs$|\.hbs$|\.md$/, "");
    const contexts = new Set(
      uses.filter((use) => use.name === name).map((use) => use.inside),
    );
    const notes: Note[] = [];

    let text = source;
    let changed = 0;
    const converted = convertSnippetAtLines(source);
    if (converted.changed > 0) {
      if (
        contexts.size > 0 &&
        [...contexts].every((inside) => FILE_LINE_IDES.has(inside))
      ) {
        ({ text, changed } = converted);
      } else {
        notes.push({
          message:
            contexts.size === 0
              ? "This snippet has @file/@source/@font lines but no page uses it, so it was left alone."
              : `This snippet has @file/@source/@font lines and is also used outside typst and openscad (${[...contexts].map((c) => c || "page text").join(", ")}), so it was left alone. Convert the lines used by typst or openscad to ::file lines yourself.`,
        });
      }
    }

    const ides = migrateSource(text, [], text, ctx);
    if (changed === 0 && ides.migrated === 0 && notes.length + ides.notes.length === 0) {
      continue;
    }
    results.push({
      file: path.relative(process.cwd(), absolute),
      migrated: ides.migrated + changed,
      notes: [...notes, ...ides.notes],
      before: source,
      after: ides.after,
    });
  }
  return results;
}

async function migrateProject(project: Hyperproject): Promise<FileResult[]> {
  if (project.type === "library") {
    const nested = await Promise.all(project.projects.map(migrateProject));
    return nested.flat();
  }
  return migrateBook(project);
}

/** Prints the lines an edit touched, old above new. */
const printDiff = (before: string, after: string) => {
  const a = before.split("\n");
  const b = after.split("\n");
  let top = 0;
  while (top < a.length && top < b.length && a[top] === b[top]) top++;
  let bottom = 0;
  while (
    bottom < a.length - top &&
    bottom < b.length - top &&
    a[a.length - 1 - bottom] === b[b.length - 1 - bottom]
  ) {
    bottom++;
  }
  for (const line of a.slice(top, a.length - bottom)) {
    console.log(chalk.red(`  - ${line}`));
  }
  for (const line of b.slice(top, b.length - bottom)) {
    console.log(chalk.green(`  + ${line}`));
  }
};

/**
 * Converts a project's pages to the current syntax of the elements that
 * changed incompatibly: the workspace syntax of pyide, webide, p5, openscad
 * and typst.
 * @returns false when nothing was written because of a problem.
 */
export async function runMigrate(
  project: Hyperproject,
  options: MigrateOptions = {},
): Promise<boolean> {
  const name = hyperproject.getName(project);

  if (!options.dryRun && !options.force && isDirty(project.src)) {
    console.error(
      `${chalk.red(`[${name}]`)} The project has uncommitted changes. Commit them first, so the migration can be reviewed with git diff and undone with git checkout, or pass --force.`,
    );
    return false;
  }

  const results = await migrateProject(project);

  let directives = 0;
  let noteCount = 0;
  for (const result of results) {
    directives += result.migrated;
    noteCount += result.notes.length;
    if (result.migrated > 0) {
      console.log(
        `${chalk.blue(result.file)}: ${result.migrated} directive${result.migrated === 1 ? "" : "s"}`,
      );
      if (options.dryRun) printDiff(result.before, result.after);
      else await fs.writeFile(path.resolve(result.file), result.after);
    }
    for (const note of result.notes) {
      const where = note.line ? `${result.file}:${note.line}` : result.file;
      console.log(`${chalk.yellow("note")} ${where}`);
      console.log(`  ${note.message}`);
    }
  }

  const verb = options.dryRun ? "would migrate" : "migrated";
  console.log(
    `${chalk.green(`[${name}]`)} ${verb} ${directives} directive${directives === 1 ? "" : "s"}` +
      (noteCount > 0 ? `, ${noteCount} note${noteCount === 1 ? "" : "s"} to review.` : "."),
  );
  return true;
}
