import type { ReactNode } from "react";
import { markRuns } from "./quick-open-fuzzy";

/**
 * Wraps the characters a fuzzy query matched in <mark>, so people can see
 * *why* a file is in the list — used by the quick open dialog and the file
 * tree's filter alike. Bolding alone is not enough of a highlight — bold
 * text keeps its color, and dim text stays dim (unreadably so in dark mode)
 * — so matched characters always get the full-contrast foreground color on
 * top of the row's own state colors.
 *
 * `marks` are the matched indices into `text`, ascending; adjacent marks
 * merge into one <mark>. Everything around the marks is still the path —
 * dropping the part after the last mark would show "book/fi" for
 * book/first-steps.md, a file that is not there.
 */
export function highlight(text: string, marks: number[]): ReactNode {
  const runs = markRuns(marks);
  if (runs.length === 0) return text;
  const parts: ReactNode[] = [];
  let from = 0;
  for (const [start, end] of runs) {
    if (start > from) parts.push(text.slice(from, start));
    parts.push(marked(text.slice(start, end), start));
    from = end;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

function marked(text: string, key: number): ReactNode {
  return (
    <mark key={key} className="bg-transparent font-semibold text-foreground">
      {text}
    </mark>
  );
}
