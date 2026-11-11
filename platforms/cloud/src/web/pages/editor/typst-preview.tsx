import { type Diagnostic, forceLinting, lintGutter, linter } from "@codemirror/lint";
import { type Extension, StateEffect, StateField, type Text } from "@codemirror/state";
import { typstLezerLintSource } from "codemirror-lang-typst/lezer";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TypstDiagnostic } from "../../../shared/typst-diagnostics";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfView } from "./pdf-view";
import type { PdfClick } from "./pdf-sync";

/** How long typing pauses before the document compiles again. */
const DEBOUNCE_MS = 600;

/** The compiler's diagnostics of the open file, kept in its editor's state. */
const setCompileDiagnostics = StateEffect.define<{ path: string; diagnostics: TypstDiagnostic[] }>();
const compileDiagnostics = StateField.define<{ path: string; diagnostics: TypstDiagnostic[] }>({
  create: () => ({ path: "", diagnostics: [] }),
  update: (value, tr) => {
    for (const effect of tr.effects) if (effect.is(setCompileDiagnostics)) return effect.value;
    return value;
  },
});

/** Typst's diagnostics as CodeMirror's: in the gutter and under the text. */
function asLintMarks(doc: Text, path: string, diagnostics: TypstDiagnostic[]): Diagnostic[] {
  return diagnostics.map((d) => {
    const here = d.file === path;
    const line = doc.line(here ? Math.min(Math.max(1, d.line), doc.lines) : 1);
    const from = here ? Math.min(line.from + Math.max(0, d.column - 1), line.to) : line.from;
    return {
      from,
      to: here ? Math.min(from + 1, line.to) : line.from,
      severity: d.severity,
      // An error in an imported file shows on the first line, naming it.
      message: here ? d.message : `${d.file}:${d.line}:${d.column}: ${d.message}`,
      source: "Typst",
    };
  });
}

/**
 * The linting of a `.typ` file: the grammar's syntax checks and the
 * compiler's diagnostics from the PDF preview in one linter. Two linters
 * would each replace the other's marks whenever they ran.
 */
export const typstLint: Extension = [
  compileDiagnostics,
  lintGutter(),
  linter(
    async (view) => {
      const own = view.state.field(compileDiagnostics);
      return [...(await typstLezerLintSource(view)), ...asLintMarks(view.state.doc, own.path, own.diagnostics)];
    },
    {
      delay: 300,
      // Also when the compiler's diagnostics came in, not only on edits.
      needsRefresh: (update) =>
        update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setCompileDiagnostics))),
    },
  ),
];

/** Shows the compiler's diagnostics for `path` in `view` (see typstLint). */
export function showTypstDiagnostics(view: EditorView, path: string, diagnostics: TypstDiagnostic[]) {
  view.dispatch({ effects: setCompileDiagnostics.of({ path, diagnostics }) });
  forceLinting(view);
}

/**
 * The last PDF of each file, so the pane shows it at once when it comes back
 * (the tab reloaded, the pane was closed and opened) instead of a blank page.
 */
const lastPdf = new Map<string, { data: ArrayBuffer; hash: string }>();

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The open `.typ` file as a PDF, compiled on the server with its unsaved
 * text shortly after each change (see hosting/renders.ts). Typst's errors
 * go to the editor's lint gutter through `onDiagnostics`.
 *
 * It must not flash: the pages are drawn by PdfView, which swaps a new
 * version in at the same scroll position; a PDF with the same bytes as the
 * shown one is not drawn again; and the last PDF stays on view while a
 * broken document is fixed.
 */
export function TypstPreviewPane({
  bookId,
  file,
  text,
  onDiagnostics,
  onJump,
}: {
  bookId: string;
  file: string;
  /** Null while the file is loading: nothing is compiled then. */
  text: string | null;
  onDiagnostics: (path: string, diagnostics: TypstDiagnostic[]) => void;
  /** A double-clicked line of the PDF, to find in the source (see pdf-sync.ts). */
  onJump?: (path: string, click: PdfClick) => void;
}) {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState(() => lastPdf.get(file) ?? null);
  const [status, setStatus] = useState<
    { kind: "idle" | "compiling" } | { kind: "failed"; error: string; diagnostics: TypstDiagnostic[] }
  >({ kind: "idle" });
  const onDiagnosticsRef = useRef(onDiagnostics);
  onDiagnosticsRef.current = onDiagnostics;
  const hashRef = useRef(pdf?.hash ?? null);

  // Another file: its own last PDF, or none.
  const fileRef = useRef(file);
  useEffect(() => {
    if (fileRef.current === file) return;
    fileRef.current = file;
    const last = lastPdf.get(file) ?? null;
    setPdf(last);
    hashRef.current = last?.hash ?? null;
    setStatus({ kind: "idle" });
  }, [file]);

  useEffect(() => {
    if (text === null) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setStatus((s) => (s.kind === "failed" ? s : { kind: "compiling" }));
      let res: Response;
      try {
        res = await fetch(`/api/books/${bookId}/files/typst-preview`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: file, text }),
          signal: abort.signal,
        });
      } catch {
        // Replaced by a newer request, or offline: the next change tries again.
        return;
      }
      if (abort.signal.aborted) return;
      if (res.ok) {
        const data = await res.arrayBuffer();
        if (abort.signal.aborted) return;
        const hash = await sha256(data);
        setStatus({ kind: "idle" });
        onDiagnosticsRef.current(file, []);
        // The same PDF as the shown one: nothing to draw, nothing flashes.
        if (hashRef.current === hash) return;
        hashRef.current = hash;
        const next = { data, hash };
        lastPdf.set(file, next);
        setPdf(next);
        return;
      }
      let body: { error?: string; diagnostics?: TypstDiagnostic[] } = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      if (abort.signal.aborted) return;
      const diagnostics = body.diagnostics ?? [];
      setStatus({ kind: "failed", error: body.error ?? t("editor.typstPreview.failed"), diagnostics });
      onDiagnosticsRef.current(file, diagnostics);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [bookId, file, text, t]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-sm" aria-live="polite">
        <span className="font-medium">{t("editor.typstPreview.title")}</span>
        {pdf && (
          <Button
            size="icon"
            variant="ghost"
            className="order-last ml-auto size-7"
            aria-label={t("editor.typstPreview.download")}
            title={t("editor.typstPreview.download")}
            onClick={() => {
              const url = URL.createObjectURL(new Blob([pdf.data], { type: "application/pdf" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `${file.split("/").pop()!.replace(/\.typ$/, "")}.pdf`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 10_000);
            }}
          >
            <DownloadIcon className="size-4" />
          </Button>
        )}
        {status.kind === "compiling" && <span className="text-muted-foreground">{t("editor.typstPreview.compiling")}</span>}
        {status.kind === "failed" && (
          <span className="text-destructive">
            {status.diagnostics.length > 0
              ? t("editor.typstPreview.errors", { count: status.diagnostics.length })
              : status.error}
          </span>
        )}
      </div>
      {status.kind === "failed" && status.diagnostics.length > 0 && (
        <ul className="max-h-40 shrink-0 overflow-y-auto border-b border-border px-3 py-2 font-mono text-xs">
          {status.diagnostics.map((d, i) => (
            <li key={i} className={d.severity === "error" ? "text-destructive" : "text-muted-foreground"}>
              {d.file}:{d.line}:{d.column}: {d.message}
            </li>
          ))}
        </ul>
      )}
      {pdf ? (
        <PdfView
          data={pdf.data}
          className="flex-1"
          onTextDoubleClick={onJump && ((text) => onJump(file, text))}
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {status.kind === "failed" ? t("editor.typstPreview.failed") : t("editor.typstPreview.compiling")}
        </p>
      )}
    </div>
  );
}
