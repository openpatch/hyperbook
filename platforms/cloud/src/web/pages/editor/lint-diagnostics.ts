import { type Diagnostic, forceLinting } from "@codemirror/lint";
import { StateEffect, StateField, type Text } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import type { PageDiagnostic } from "../../../shared/page-diagnostics";

/*
 * What `hyperbook lint` says about the open page (broken links, missing
 * files, elements the plugins reject), as the server reports it with each
 * render of the preview, or on its own while the preview is closed. Shown
 * in the page's linter (page-language.ts) next to the editor's own checks.
 *
 * The reply comes a while after the text was sent. The marks are kept as
 * positions in the document and move with each edit, so they stay on their
 * text while the teacher types. A reply for text that has changed since is
 * dropped: its lines may not be where they were, and a reply for the newer
 * text is on its way anyway.
 */

type Mark = {
  from: number;
  to: number;
  severity: PageDiagnostic["severity"];
  message: string;
  /** Unplaced diagnostics show on the first line; they do not move. */
  placed: boolean;
};

const setMarks = StateEffect.define<Mark[]>();

/** The marks of the page; part of the page language. */
export const lintMarks = StateField.define<Mark[]>({
  create: () => [],
  update(marks, tr) {
    for (const effect of tr.effects) if (effect.is(setMarks)) return effect.value;
    if (!tr.docChanged || marks.length === 0) return marks;
    return marks.map((m) => {
      if (!m.placed) return m;
      const from = tr.changes.mapPos(m.from, 1);
      return { ...m, from, to: Math.max(from, tr.changes.mapPos(m.to, -1)) };
    });
  },
});

/** Whether the marks changed: the linter shows them anew. */
export const lintMarksChanged = (update: ViewUpdate) =>
  update.transactions.some((tr) => tr.effects.some((e) => e.is(setMarks)));

/** A word, a link or a path: from `from` up to the next space, at least one character. */
function tokenEnd(doc: Text, from: number, lineTo: number): number {
  const rest = doc.sliceString(from, lineTo);
  const space = rest.search(/\s/);
  return Math.min(lineTo, from + Math.max(1, space === -1 ? rest.length : space));
}

function toMarks(doc: Text, path: string, diagnostics: PageDiagnostic[]): Mark[] {
  const marks: Mark[] = [];
  for (const d of diagnostics) {
    if (d.file !== path) continue;
    if (d.line === undefined) {
      // Somewhere on the page (e.g. in a snippet it includes): the first line says so.
      const first = doc.line(1);
      marks.push({ from: first.from, to: first.from, severity: d.severity, message: d.message, placed: false });
      continue;
    }
    const line = doc.line(Math.min(Math.max(1, d.line), doc.lines));
    const from = d.column === undefined ? line.from : Math.min(line.from + Math.max(0, d.column - 1), line.to);
    const to = d.column === undefined ? line.to : tokenEnd(doc, from, line.to);
    marks.push({ from, to, severity: d.severity, message: d.message, placed: true });
  }
  return marks;
}

/**
 * Shows what lint said about `text` of the page `path` in its editor, if
 * the editor still has that text.
 */
export function showLintDiagnostics(view: EditorView, path: string, text: string, diagnostics: PageDiagnostic[]) {
  const doc = view.state.doc;
  if (doc.length !== text.length || doc.toString() !== text) return;
  view.dispatch({ effects: setMarks.of(toMarks(doc, path, diagnostics)) });
  forceLinting(view);
}

/**
 * The marks as diagnostics, leaving out lines the editor's own checks speak
 * about already: they are instant and come with fixes, and the same slip
 * twice in a row says nothing more.
 */
export function lintMarksAsDiagnostics(view: EditorView, own: Diagnostic[]): Diagnostic[] {
  const { doc } = view.state;
  const taken = new Set(own.map((d) => doc.lineAt(d.from).number));
  return view.state
    .field(lintMarks, false)
    ?.filter((m) => !m.placed || !taken.has(doc.lineAt(Math.min(m.from, doc.length)).number))
    .map((m) => ({
      from: Math.min(m.from, doc.length),
      to: Math.min(m.to, doc.length),
      severity: m.severity,
      message: m.message,
      source: "Hyperbook",
    })) ?? [];
}
