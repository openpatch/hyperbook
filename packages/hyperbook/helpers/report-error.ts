import chalk from "chalk";
import { breakProgressLine } from "./terminal";

/**
 * Prints a build failure.
 *
 * Errors raised from the markdown pipeline are VFileMessages, whose default
 * console rendering is a large object dump that buries the actual reason. When
 * one of those comes through, show the file, the position and the reason
 * instead.
 */
export function reportError(e: unknown): void {
  const message = e as {
    reason?: string;
    file?: string;
    line?: number | null;
    column?: number | null;
    name?: string;
  };

  // A JsonParseError carries the same shape, so it renders through the branch
  // below — the config's path and the line the author broke.
  if (message && typeof message.reason === "string") {
    const where = [message.file, message.line, message.column]
      .filter((part) => part !== undefined && part !== null)
      .join(":");
    if (where) {
      console.error(`${chalk.red("error")} ${where}`);
    } else {
      console.error(chalk.red("error"));
    }
    console.error(message.reason);
    return;
  }

  console.error(e);
}

/** Where a diagnostic points, rendered as `path:line:column`. */
function formatPlace(message: {
  file?: string | null;
  line?: number | null;
  column?: number | null;
}): string {
  return [message.file, message.line, message.column]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(":");
}

export type MessageCounts = { warnings: number; infos: number };

/**
 * Maps a diagnostic's line back onto the file the author edits.
 *
 * Positions come from the markdown handed to the pipeline, which has had its
 * frontmatter stripped and its snippets expanded inline. When the processed
 * content is still a suffix of the source, the difference is a fixed line
 * shift. When it is not — snippets and handlebars templates rewrite the middle
 * of the file — no honest mapping exists, so `null` is returned and positions
 * are omitted rather than reported wrongly.
 */
export function lineOffsetFor(
  source: string,
  processed: string,
): number | null {
  if (!source.endsWith(processed)) return null;
  return source.slice(0, source.length - processed.length).split("\n").length - 1;
}

export interface ReportMessagesOptions {
  prefix?: string;
  /**
   * Lines to add to each position, or null when they cannot be trusted.
   * Omit entirely to report positions unchanged.
   */
  lineOffset?: number | null;
}

/**
 * Prints the non-fatal diagnostics a processed file collected.
 *
 * The markdown plugins report the most common authoring mistakes — the wrong
 * number of colons on a directive, a learningmap pointing at a missing file, a
 * password block that anyone can open — through `file.info` and `file.message`.
 * Nothing used to read them back, so the author never saw any of it.
 */
export function reportMessages(
  file: { messages?: unknown[] },
  options: ReportMessagesOptions = {},
): MessageCounts {
  const { prefix, lineOffset = 0 } = options;
  const counts: MessageCounts = { warnings: 0, infos: 0 };
  const label = prefix ? `${chalk.blue(`[${prefix}]`)} ` : "";
  let started = false;

  for (const raw of file.messages || []) {
    const message = raw as {
      reason?: string;
      fatal?: boolean | null;
      file?: string | null;
      line?: number | null;
      column?: number | null;
      note?: string | null;
      ruleId?: string | null;
    };

    // `fatal: true` already surfaced as a thrown error; skip it here so a
    // failed build does not print the same problem twice.
    if (message.fatal) continue;

    // `fatal: false` is a warning, `fatal: null | undefined` is informational.
    const isWarning = message.fatal === false;
    if (isWarning) {
      counts.warnings++;
    } else {
      counts.infos++;
    }

    // The build draws its progress by rewriting one line, so the cursor may be
    // sitting at the end of it. Close it before the first diagnostic, or the
    // output reads "Building book: [1/7]info /path/to/page.md:3:1".
    if (!started) {
      breakProgressLine();
      started = true;
    }

    const severity = isWarning
      ? chalk.yellow("warning")
      : chalk.cyan("info");
    const place = formatPlace(
      lineOffset === null
        ? { file: message.file, line: null, column: null }
        : { ...message, line: message.line ? message.line + lineOffset : null },
    );
    console.error(`${label}${severity} ${place}`.trimEnd());
    console.error(`  ${message.reason}`);
    if (message.note) {
      console.error(`  ${chalk.dim(message.note)}`);
    }
  }

  return counts;
}

/** Renders the tail of a build, e.g. "2 warnings, 1 info". */
export function formatMessageSummary(counts: MessageCounts): string {
  const parts: string[] = [];
  if (counts.warnings > 0) {
    parts.push(`${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`);
  }
  if (counts.infos > 0) {
    parts.push(`${counts.infos} info${counts.infos === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}
