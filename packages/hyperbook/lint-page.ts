import fs from "fs/promises";
import { VFileBook, VFileGlossary } from "@hyperbook/fs";
import { HyperbookContext, HyperbookPage, Navigation } from "@hyperbook/types";
import { processBookPage, processGlossaryPage } from "./build";
import { Finding, LinkIndex, pageLinkFindings } from "./check";
import { lineOffsetFor } from "./helpers/report-error";

/*
 * The diagnostics of single pages, shared by `hyperbook lint` (every page)
 * and `hyperbook render` (the page a host renders or asks about, e.g. the
 * page open in Hyperbook Cloud's editor). Both read the book once and then
 * go page by page, so a host can interleave them with other work.
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

/** What linting a page needs of its book, read once for many pages. */
export interface LintState {
  baseCtx: Pick<
    HyperbookContext,
    "config" | "makeUrl" | "project" | "root" | "version" | "passwords"
  >;
  pageList: HyperbookPage[];
  pagesAndSections: Pick<Navigation, "pages" | "sections" | "glossary">;
  links: LinkIndex;
}

export type RawMessage = {
  reason?: string;
  message?: string;
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

/** A message of the markdown pipeline as a finding in the page's source. */
export function toFinding(
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

/** A check's finding as a lint finding. */
export function fromCheck(f: Finding): LintFinding {
  return {
    file: f.file,
    line: f.line,
    column: f.column,
    severity: f.severity,
    rule: f.rule,
    message: f.reason,
  };
}

/**
 * A page the pipeline gave up on (a plugin's file.fail, or something threw):
 * a build would stop there, so it is an error either way.
 */
export async function failureFinding(
  page: VFileBook | VFileGlossary,
  e: unknown,
): Promise<LintFinding> {
  const absolute = page.path.absolute;
  const message = (e ?? {}) as RawMessage;
  const source = await fs.readFile(absolute, "utf8").catch(() => "");
  return toFinding(
    absolute,
    {
      ...message,
      reason: message.reason ?? message.message ?? String(e),
      fatal: true,
    },
    lineOffsetFor(source, page.markdown.content),
  );
}

/**
 * The findings of a page a build made: what its plugins reported, and its
 * links that point at nothing.
 */
export async function renderedPageFindings(
  page: VFileBook | VFileGlossary,
  rawMessages: unknown[],
  lineOffset: number | null,
  links: LinkIndex,
): Promise<LintFinding[]> {
  const absolute = page.path.absolute;
  return [
    ...rawMessages.map((m) => toFinding(absolute, m as RawMessage, lineOffset)),
    ...(await pageLinkFindings(links, page)).map(fromCheck),
  ];
}

/**
 * Runs one page through the same markdown pipeline a build uses, writing
 * nothing, and collects everything wrong with it.
 */
export async function lintPage(
  state: LintState,
  page: VFileBook | VFileGlossary,
): Promise<LintFinding[]> {
  try {
    const { result, lineOffset } =
      page.folder === "glossary"
        ? await processGlossaryPage(
            page as VFileGlossary,
            state.baseCtx,
            state.pageList,
            state.pagesAndSections,
          )
        : await processBookPage(
            page as VFileBook,
            state.baseCtx,
            state.pageList,
            state.pagesAndSections,
          );
    return renderedPageFindings(page, result.messages, lineOffset, state.links);
  } catch (e) {
    // Its links are checked without the pipeline, so they still are.
    return [
      await failureFinding(page, e),
      ...(await pageLinkFindings(state.links, page)).map(fromCheck),
    ];
  }
}
