import type { Diagnostic } from "@codemirror/lint";
import { Facet, type Text } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import i18next from "i18next";

/** An error the teacher wants explained: what it says and where. */
export type ExplainRequest = {
  message: string;
  /** Line of the error, from 1. */
  line: number;
  /** The lines around it, numbered, as the question quotes them. */
  excerpt: string;
};

/**
 * Who answers "Explain with AI" on an error (the AI panel); none where the
 * AI is not available, and the errors then carry no such button.
 */
export const explainWithAi = Facet.define<(request: ExplainRequest) => void, ((request: ExplainRequest) => void) | null>({
  combine: (handlers) => handlers[0] ?? null,
});

/** How many lines before and after the error go along. */
const AROUND = 3;

/** The lines around `pos`, each with its number, the error's line marked. */
export function excerptAt(doc: Text, pos: number): { line: number; excerpt: string } {
  const at = doc.lineAt(Math.min(pos, doc.length)).number;
  const first = Math.max(1, at - AROUND);
  const last = Math.min(doc.lines, at + AROUND);
  const width = String(last).length;
  const lines: string[] = [];
  for (let n = first; n <= last; n++)
    lines.push(`${n === at ? ">" : " "} ${String(n).padStart(width)} | ${doc.line(n).text}`);
  return { line: at, excerpt: lines.join("\n") };
}

/** Adds "Explain with AI" to each error and warning, when someone answers it. */
export function withExplain(view: EditorView, diagnostics: Diagnostic[]): Diagnostic[] {
  const handler = view.state.facet(explainWithAi);
  if (!handler) return diagnostics;
  return diagnostics.map((d) =>
    d.severity === "error" || d.severity === "warning"
      ? {
          ...d,
          actions: [
            ...(d.actions ?? []),
            {
              name: i18next.t("editor.explain.action"),
              apply: (v: EditorView, from: number) => {
                const answer = v.state.facet(explainWithAi);
                if (!answer) return;
                answer({ message: d.message, ...excerptAt(v.state.doc, from) });
              },
            },
          ],
        }
      : d,
  );
}

/** For a linter's `needsRefresh`: whether the AI came or went, so the buttons follow. */
export const explainChanged = (update: ViewUpdate) =>
  update.startState.facet(explainWithAi) !== update.state.facet(explainWithAi);
