import path from "path";
import fs from "fs/promises";
import chalk from "chalk";
import { hyperproject, VFileBook, VFileGlossary } from "@hyperbook/fs";
import { Hyperproject } from "@hyperbook/types";
import { checkProject } from "./check";
import { processBookPage, processGlossaryPage } from "./build";
import { PageRenderer } from "./render";
import { lineOffsetFor } from "./helpers/report-error";

/*
 * `hyperbook lint`: everything that can be wrong with a book without building
 * it, in one place and in a form a program can act on.
 *
 * Every page goes through the same markdown pipeline a build uses, so what
 * the plugins report — unknown or unclosed directives, missing `src` files,
 * the wrong number of colons — is exactly what a build would print, and
 * nothing is written. On top of that come the book-wide checks of
 * `hyperbook check` (links, permalinks, config keys).
 *
 * Meant for authors and for agents that write Hyperbook markdown: `--json`
 * gives one object to parse, and the exit code says whether to look at it.
 */

export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  /** Absolute path of the file the problem is in. */
  file: string;
  line?: number;
  column?: number;
  severity: LintSeverity;
  /** Stable id for the kind of problem, when the reporter gave one. */
  rule?: string;
  message: string;
}

export interface LintOptions {
  /** Only lint these files or folders (relative to `cwd` or absolute). */
  paths?: string[];
  json?: boolean;
  /** Also fail on infos, not only on errors and warnings. */
  strict?: boolean;
  cwd?: string;
}

type RawMessage = {
  reason?: string;
  fatal?: boolean | null;
  line?: number | null;
  column?: number | null;
  ruleId?: string | null;
  note?: string | null;
};

/** vfile's three levels: fatal is an error, false a warning, null an info. */
function severityOf(message: RawMessage): LintSeverity {
  if (message.fatal) return "error";
  return message.fatal === false ? "warning" : "info";
}

function toFinding(
  file: string,
  message: RawMessage,
  lineOffset: number | null,
): LintFinding {
  const placed = lineOffset !== null && typeof message.line === "number";
  return {
    file,
    line: placed ? message.line! + lineOffset! : undefined,
    column: placed ? (message.column ?? undefined) : undefined,
    severity: severityOf(message),
    rule: message.ruleId ?? undefined,
    message: [message.reason, message.note].filter(Boolean).join(" "),
  };
}

/** Whether `file` is one of `paths` or inside one of them. */
function selected(file: string, paths: string[] | undefined): boolean {
  if (!paths) return true;
  return paths.some(
    (p) =>
      file === p || file.startsWith(p.endsWith(path.sep) ? p : p + path.sep),
  );
}

/** Runs every page of one book through the pipeline, collecting diagnostics. */
async function lintPages(
  book: Hyperproject,
  rootProject: Hyperproject,
  paths: string[] | undefined,
): Promise<{ findings: LintFinding[]; pages: string[] }> {
  const findings: LintFinding[] = [];
  const pages: string[] = [];
  // Only read: book() loads what a render needs and writes nothing.
  const { baseCtx, pagesAndSections, pageList, bookFiles, glossaryFiles } =
    await new PageRenderer(book.src, rootProject).book();

  const all: (VFileBook | VFileGlossary)[] = [...bookFiles, ...glossaryFiles];
  for (const file of all) {
    const absolute = file.path.absolute;
    if (!selected(absolute, paths)) continue;
    pages.push(absolute);

    try {
      const { result, lineOffset } =
        file.folder === "glossary"
          ? await processGlossaryPage(
              file as VFileGlossary,
              baseCtx,
              pageList,
              pagesAndSections,
            )
          : await processBookPage(
              file as VFileBook,
              baseCtx,
              pageList,
              pagesAndSections,
            );
      for (const message of result.messages) {
        findings.push(toFinding(absolute, message, lineOffset));
      }
    } catch (e) {
      // A plugin gave up on the page (file.fail) or something threw: the
      // build would stop here, so this is an error either way.
      const message = e as RawMessage & { message?: string };
      const source = await fs.readFile(absolute, "utf8").catch(() => "");
      findings.push(
        toFinding(
          absolute,
          {
            ...message,
            reason: message.reason ?? message.message ?? String(e),
            fatal: true,
          },
          lineOffsetFor(source, file.markdown.content),
        ),
      );
    }
  }
  return { findings, pages };
}

/** Lints every book in a project tree. */
async function lintProject(
  project: Hyperproject,
  rootProject: Hyperproject,
  paths: string[] | undefined,
): Promise<{ findings: LintFinding[]; pages: string[] }> {
  if (project.type === "library") {
    const nested = await Promise.all(
      project.projects.map((p) => lintProject(p, rootProject, paths)),
    );
    return {
      findings: nested.flatMap((n) => n.findings),
      pages: nested.flatMap((n) => n.pages),
    };
  }
  try {
    return await lintPages(project, rootProject, paths);
  } catch (e) {
    // The book could not even be read: broken frontmatter, a bad
    // hyperbook.json. Report it where it happened and carry on.
    const message = e as RawMessage & { file?: string; message?: string };
    return {
      findings: [
        {
          file: message.file || project.src,
          line: message.line ?? undefined,
          column: message.column ?? undefined,
          severity: "error",
          message: message.reason ?? message.message ?? String(e),
        },
      ],
      pages: [],
    };
  }
}

const ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Collects every finding for a project, sorted by file and position. */
export async function lint(
  project: Hyperproject,
  options: Pick<LintOptions, "paths" | "cwd"> = {},
): Promise<{ findings: LintFinding[]; pages: string[] }> {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths?.length
    ? options.paths.map((p) => path.resolve(cwd, p))
    : undefined;

  const pages = await lintProject(project, project, paths);
  const checks = (await checkProject(project))
    .filter((f) => selected(f.file, paths))
    .map((f): LintFinding => ({
      file: f.file,
      line: f.line,
      column: f.column,
      severity: f.severity,
      rule: f.rule,
      message: f.reason,
    }));

  const findings = [...pages.findings, ...checks];

  // A path that names no page is most likely a typo, or a file outside the
  // book's book/ and glossary/ folders, which no build will ever look at.
  for (const p of paths ?? []) {
    const isConfig = /hyper(book|library)\.json$/.test(p);
    if (!isConfig && !pages.pages.some((page) => selected(page, [p]))) {
      findings.push({
        file: p,
        severity: "error",
        rule: "not-a-page",
        message:
          "No page of the book is here. Pages live in the book's book/ and glossary/ folders, as .md, .md.hbs, .md.json or .md.yml files.",
      });
    }
  }

  findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.column ?? 0) - (b.column ?? 0) ||
      ORDER[a.severity] - ORDER[b.severity] ||
      (a.rule ?? "").localeCompare(b.rule ?? ""),
  );
  return { findings, pages: pages.pages };
}

/**
 * Runs `hyperbook lint` and prints the result.
 * @returns true when nothing failing was found.
 */
export async function runLint(
  project: Hyperproject,
  options: LintOptions = {},
): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();
  const name = hyperproject.getName(project);
  const relative = (file: string) => path.relative(cwd, file) || file;

  if (!options.json) {
    console.log(`${chalk.blue(`[${name}]`)} Linting ${project.src}`);
  }

  // Plugins and loaders may log; with --json, stdout must be the JSON alone.
  const log = console.log;
  if (options.json) console.log = console.error;
  let result: Awaited<ReturnType<typeof lint>>;
  try {
    result = await lint(project, { paths: options.paths, cwd });
  } finally {
    console.log = log;
  }
  const { findings, pages } = result;

  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const ok =
    counts.error === 0 &&
    counts.warning === 0 &&
    !(options.strict && counts.info > 0);

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok,
          pages: pages.length,
          errors: counts.error,
          warnings: counts.warning,
          infos: counts.info,
          findings: findings.map((f) => ({ ...f, file: relative(f.file) })),
        },
        null,
        2,
      ) + "\n",
    );
    return ok;
  }

  const colour = { error: chalk.red, warning: chalk.yellow, info: chalk.cyan };
  for (const f of findings) {
    const where = [relative(f.file), f.line, f.column]
      .filter((part) => part !== undefined)
      .join(":");
    const rule = f.rule ? chalk.dim(` [${f.rule}]`) : "";
    console.error(`${colour[f.severity](f.severity)} ${where}${rule}`);
    console.error(`  ${f.message}`);
  }

  const checked = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
  if (findings.length === 0) {
    console.log(`${chalk.green(`[${name}]`)} ${checked}, no problems found.`);
    return true;
  }
  const parts = (["error", "warning", "info"] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}${counts[s] === 1 ? "" : "s"}`);
  console.log(
    `${(ok ? chalk.green : chalk.yellow)(`[${name}]`)} ${checked}, ${parts.join(", ")}.`,
  );
  return ok;
}
