/*
 * What `hyperbook lint` says is wrong with a page or a book, as the CLI's
 * render process reports it (see packages/hyperbook/lint-page.ts): for the
 * editor's lint gutter and the check of all pages.
 */

export type PageDiagnostic = {
  /** The file, relative to the book. */
  file: string;
  /** 1-based, in the file as the author edits it; absent when unknown. */
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
  /** Stable id of the kind of problem (e.g. "broken-link"), when known. */
  rule?: string;
  message: string;
};

const SEVERITIES = new Set(["error", "warning", "info"]);

/** The diagnostics of a reply, dropping anything that is not one. */
export function readDiagnostics(value: unknown): PageDiagnostic[] {
  if (!Array.isArray(value)) return [];
  const out: PageDiagnostic[] = [];
  for (const d of value) {
    if (!d || typeof d !== "object") continue;
    const { file, line, column, severity, rule, message } = d as Record<string, unknown>;
    if (typeof file !== "string" || typeof message !== "string" || !SEVERITIES.has(severity as string)) continue;
    out.push({
      file,
      line: typeof line === "number" ? line : undefined,
      column: typeof column === "number" ? column : undefined,
      severity: severity as PageDiagnostic["severity"],
      rule: typeof rule === "string" ? rule : undefined,
      message,
    });
  }
  return out;
}
