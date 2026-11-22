import { useEffect, useRef } from "react";
import { api, unwrap } from "@/lib/api";
import type { PageDiagnostic } from "../../../shared/page-diagnostics";
import { type Workspace, useLiveText } from "./workspace";

/**
 * How long typing pauses before the page is linted again. Longer than the
 * preview's: nobody is watching a page change, and on a large book the
 * server takes about as long to lint a page as to render it.
 */
const DEBOUNCE_MS = 1000;

/**
 * While the preview is closed, nothing renders the open page, so nothing
 * says what lint finds on it: this asks for that alone (no page is rendered)
 * after a pause in typing and after each save. One request at a time, like
 * the preview's; what changes meanwhile is linted once it is answered.
 * Renders nothing.
 */
export function PageLint({
  ws,
  bookId,
  file,
  commit,
  onDiagnostics,
}: {
  ws: Workspace;
  bookId: string;
  /** The page open in the editor; null for other files. */
  file: string | null;
  /** The newest save: links to files it added or removed resolve anew. */
  commit: string | null;
  onDiagnostics: (file: string, text: string, diagnostics: PageDiagnostic[]) => void;
}) {
  const text = useLiveText(ws, file);
  const onDiagnosticsRef = useRef(onDiagnostics);
  onDiagnosticsRef.current = onDiagnostics;
  const latest = useRef(0);
  const running = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (file === null || text === undefined) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      while (running.current) await running.current;
      if (ticket !== latest.current) return;
      running.current = (async () => {
        try {
          const res = await unwrap(
            api.books[":id"].files.lint.$post({ param: { id: bookId }, json: { path: file, text } }),
          );
          if (res.ok) onDiagnosticsRef.current(file, text, res.diagnostics);
        } catch {
          // A hint, not a task: the next pause in typing asks again.
        }
      })();
      await running.current;
      running.current = null;
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [bookId, file, text, commit]);

  return null;
}
