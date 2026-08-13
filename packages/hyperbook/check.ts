import path from "path";
import fs from "fs/promises";
import chalk from "chalk";
import { hyperproject, vfile, VFileBook } from "@hyperbook/fs";
import { Hyperproject, isExternalUrl } from "@hyperbook/types";
import { collectLinkTargets } from "@hyperbook/markdown";

export interface CheckOptions {
  /** Treat warnings as failures too, for CI gating. */
  strict?: boolean;
}

export interface Finding {
  file: string;
  line?: number;
  column?: number;
  reason: string;
  severity: "error" | "warning";
}

/** Schemes that never point at something inside the book. */
const EXTERNAL_SCHEME = /^(mailto:|tel:|data:|javascript:)/i;

/**
 * Splits a URL into the part that must resolve to a file and the fragment.
 * Returns null when the URL is not ours to check.
 */
export function targetOf(url: string): string | null {
  if (!url) return null;
  if (isExternalUrl(url) || EXTERNAL_SCHEME.test(url)) return null;
  // A bare fragment points inside the current page.
  if (url.startsWith("#")) return null;

  const withoutFragment = url.split("#")[0].split("?")[0];
  if (!withoutFragment) return null;
  return withoutFragment;
}

/**
 * Source extensions `makeUrl` strips, so a link may carry any of them.
 * Longest first, since `.md` is a suffix of the others.
 */
const PAGE_EXTENSIONS = [".md.hbs", ".md.json", ".md.yml", ".md"];

/**
 * Normalizes a book-relative href for comparison.
 *
 * Folds together the spellings that address the same page: an index page is
 * addressed by its directory but authors reasonably write `/section/index`,
 * and a link may name the source file (`/elements/alert.md`) because
 * `makeUrl` strips the extension when rendering.
 */
export function normalize(href: string): string {
  let out = href.replace(/\/+$/, "");
  if (!out.startsWith("/")) out = `/${out}`;

  for (const extension of PAGE_EXTENSIONS) {
    if (out.endsWith(extension)) {
      out = out.slice(0, -extension.length);
      break;
    }
  }

  if (out.endsWith("/index")) out = out.slice(0, -"/index".length);
  return out || "/";
}

/**
 * The directory a relative link on this page resolves against.
 *
 * Mirrors `resolveRelativePath` in build.ts, which is what actually rewrites
 * these URLs. The distinction matters for index pages: their `href` is the
 * directory itself (`/section` for `section/index.md`), so taking `dirname` of
 * it — correct for every other page — climbs one level too far and reports
 * working links as broken.
 */
function linkBaseDirectory(file: {
  path: { directory?: string; href: string | null };
}): string {
  if (file.path.directory) return path.posix.join("/", file.path.directory);
  return path.posix.dirname(file.path.href || "/");
}

/**
 * How many lines of the source precede the markdown the parser saw.
 *
 * `markdown.content` has had its frontmatter stripped, so positions from the
 * parse are shifted relative to the file the author edits. When the content is
 * no longer a suffix of the source — snippets and handlebars templates are
 * expanded inline — no honest mapping exists and positions are dropped rather
 * than reported wrongly.
 */
async function lineOffsetFor(
  absolutePath: string,
  content: string,
): Promise<number | null> {
  let source: string;
  try {
    source = await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
  if (!source.endsWith(content)) return null;
  return source.slice(0, source.length - content.length).split("\n").length - 1;
}

/**
 * Locates a frontmatter key in the source, so a diagnostic can point at it.
 *
 * Frontmatter is stripped before the markdown is parsed, so its positions are
 * not in the tree. Returns undefined rather than guessing when the key cannot
 * be found.
 */
async function frontmatterFieldLine(
  absolutePath: string,
  field: string,
): Promise<number | undefined> {
  let source: string;
  try {
    source = await fs.readFile(absolutePath, "utf8");
  } catch {
    return undefined;
  }

  const lines = source.split("\n");
  // Only look inside the leading `---` block.
  if (lines[0]?.trim() !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return undefined;
    if (new RegExp(`^\\s*${field}\\s*:`).test(lines[i])) return i + 1;
  }
  return undefined;
}

/**
 * Reports permaids claimed by more than one page.
 *
 * The build writes each permalink to `@/<permaid>.html`, so duplicates
 * silently overwrite one another and whichever page happens to be built last
 * wins. The losing page stays reachable at its own URL, but its permalink —
 * the stable address the author published precisely so it would not change —
 * quietly points at a different page.
 */
async function duplicatePermaidFindings(
  permaids: Map<string, VFileBook[]>,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const [permaid, files] of permaids) {
    if (files.length < 2) continue;

    // The last page built is the one that survives, so the earlier ones are
    // the ones losing their permalink. Report each of them against the winner.
    const winner = files[files.length - 1];
    for (const file of files.slice(0, -1)) {
      findings.push({
        file: file.path.absolute,
        line: await frontmatterFieldLine(file.path.absolute, "permaid"),
        reason:
          `Duplicate permaid "${permaid}", also declared by ${winner.path.relative}. ` +
          `Only one page can own /@/${permaid}; this one loses it.`,
        severity: "error",
      });
    }
  }

  return findings;
}

/**
 * Verifies that every internal link and image in a book resolves.
 *
 * `remarkLink` and `remarkImage` rewrite URLs without ever checking that the
 * target exists, so a mistyped page or a renamed screenshot builds cleanly and
 * only 404s once a reader clicks it.
 */
export async function checkBook(project: Hyperproject): Promise<Finding[]> {
  const root = project.src;
  const findings: Finding[] = [];

  const bookFiles = await vfile.listForFolder(root, "book");
  const glossaryFiles = await vfile.listForFolder(root, "glossary");
  const publicFiles = [
    ...(await vfile.listForFolder(root, "public")),
    ...(await vfile.listForFolder(root, "book-public")),
    ...(await vfile.listForFolder(root, "glossary-public")),
  ];

  // Everything a link is allowed to point at.
  const known = new Set<string>();
  for (const file of [...bookFiles, ...glossaryFiles]) {
    if (file.path.href) known.add(normalize(file.path.href));
  }
  for (const file of publicFiles) {
    if (file.path.href) known.add(normalize(file.path.href));
  }
  // The book root is always addressable even though no file is named "/".
  known.add("/");

  // Permalinks come only from book pages: `buildSingleBookPage` is the one
  // that writes `@/<permaid>.html`, so a permaid on a glossary page produces
  // no file and a link to it would 404.
  /** permaid -> the book pages declaring it, in build order. */
  const permaids = new Map<string, VFileBook[]>();
  for (const file of bookFiles) {
    const permaid = (file as VFileBook).markdown?.data?.permaid;
    if (!permaid) continue;
    known.add(normalize(`/@/${permaid}`));
    const existing = permaids.get(permaid);
    if (existing) {
      existing.push(file as VFileBook);
    } else {
      permaids.set(permaid, [file as VFileBook]);
    }
  }

  findings.push(...(await duplicatePermaidFindings(permaids)));

  // Inside a library each book is served under its own basePath, and authors
  // write the deployed URL ("/de/elements/tabs"), while the hrefs collected
  // above are book-relative ("/elements/tabs").
  const basePath = normalize(project.basePath || "/");
  const stripBasePath = (href: string): string => {
    if (basePath === "/") return href;
    if (href === basePath) return "/";
    if (href.startsWith(`${basePath}/`)) return href.slice(basePath.length);
    return href;
  };

  for (const file of [...bookFiles, ...glossaryFiles]) {
    const content = file.markdown?.content;
    if (typeof content !== "string") continue;

    const offset = await lineOffsetFor(file.path.absolute, content);

    for (const target of collectLinkTargets(content)) {
      const raw = targetOf(target.url);
      if (raw === null) continue;

      // Relative targets resolve against the page's own directory.
      const resolved = raw.startsWith("/")
        ? normalize(raw)
        : normalize(path.posix.resolve(linkBaseDirectory(file), raw));

      if (known.has(resolved)) continue;
      if (known.has(stripBasePath(resolved))) continue;

      findings.push({
        file: file.path.absolute,
        line:
          offset !== null && target.line !== undefined
            ? target.line + offset
            : undefined,
        column: offset !== null ? target.column : undefined,
        reason: `${target.kind} target does not exist: ${target.url}`,
        severity: "error",
      });
    }
  }

  return findings;
}

/**
 * Flags config keys Hyperbook does not know about.
 *
 * Unknown keys are ignored silently at build time, so a typo like `"seach"`
 * turns the feature off with no indication anywhere that it was ever asked for.
 * Only the top level is checked: that is where the schema is flat enough for
 * the answer to be unambiguous, and where the mistakes actually happen.
 */
async function checkConfigKeys(project: Hyperproject): Promise<Finding[]> {
  const configName =
    project.type === "library" ? "hyperlibrary.json" : "hyperbook.json";
  const schemaName =
    project.type === "library"
      ? "hyperlibrary.schema.json"
      : "hyperbook.schema.json";

  let known: Set<string>;
  try {
    const schema = JSON.parse(
      await fs.readFile(
        path.join(__dirname, "schemas", schemaName),
        "utf8",
      ),
    );
    known = new Set(Object.keys(schema.properties || {}));
  } catch {
    // Shipped alongside the CLI; if it is missing, skip rather than fail.
    return [];
  }
  if (known.size === 0) return [];
  // Authors are encouraged to point editors at the schema.
  known.add("$schema");

  const configPath = path.join(project.src, configName);
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch {
    // A malformed config already fails earlier, with a position.
    return [];
  }

  return Object.keys(config)
    .filter((key) => !known.has(key))
    .map((key) => ({
      file: configPath,
      reason: `Unknown option "${key}". It has no effect. Expected one of: ${[
        ...known,
      ]
        .sort()
        .join(", ")}`,
      severity: "warning" as const,
    }));
}

/** Walks a project tree, checking every book it contains. */
async function checkProject(project: Hyperproject): Promise<Finding[]> {
  const config = await checkConfigKeys(project);
  if (project.type === "library") {
    const nested = await Promise.all(project.projects.map(checkProject));
    return [...config, ...nested.flat()];
  }
  return [...config, ...(await checkBook(project))];
}

/**
 * Runs every static check over a project.
 * @returns true when nothing blocking was found.
 */
export async function runCheck(
  project: Hyperproject,
  options: CheckOptions = {},
): Promise<boolean> {
  const name = hyperproject.getName(project);
  console.log(`${chalk.blue(`[${name}]`)} Checking ${project.src}`);

  const findings = await checkProject(project);

  for (const finding of findings) {
    const where = [finding.file, finding.line, finding.column]
      .filter((part) => part !== undefined && part !== null)
      .join(":");
    const severity =
      finding.severity === "error" ? chalk.red("error") : chalk.yellow("warning");
    console.error(`${severity} ${where}`);
    console.error(`  ${finding.reason}`);
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;

  if (findings.length === 0) {
    console.log(`${chalk.green(`[${name}]`)} No problems found.`);
    return true;
  }

  const parts = [
    errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : "",
    warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  console.log(`${chalk.yellow(`[${name}]`)} ${parts.join(", ")}.`);

  return errors === 0 && !(options.strict && warnings > 0);
}
