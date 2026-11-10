/*
 * Typst's diagnostics (`--diagnostic-format short`), one per line:
 *
 *   book/blatt.typ:3:1: error: unknown variable: nope
 *
 * read into what the editor's lint gutter shows. Lines that are not
 * diagnostics (hints, notes) are attached to the diagnostic before them.
 */

export type TypstDiagnostic = {
  /** The file, relative to the book, as Typst named it. */
  file: string;
  /** 1-based, as Typst counts. */
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
};

const LINE = /^(.+?):(\d+):(\d+): (error|warning): (.*)$/;

export function parseTypstDiagnostics(text: string): TypstDiagnostic[] {
  const diagnostics: TypstDiagnostic[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const match = LINE.exec(line);
    if (match) {
      diagnostics.push({
        file: match[1]!.replace(/^\.\//, ""),
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4] as "error" | "warning",
        message: match[5]!,
      });
    } else if (diagnostics.length > 0) {
      diagnostics[diagnostics.length - 1]!.message += `\n${line.trim()}`;
    }
  }
  return diagnostics;
}
