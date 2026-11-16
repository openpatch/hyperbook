import { EditorState } from "@codemirror/state";
import i18next from "i18next";

/*
 * CodeMirror's own words (the search panel, "go to line", the list of
 * problems, folding, what screen readers are told) in the app's language.
 * CodeMirror looks each English phrase up in EditorState.phrases; the
 * translations come from the catalog's `editor.codemirror` keys. A `$`
 * stands for a number CodeMirror puts in.
 */
const KEYS = {
  Find: "find",
  Replace: "replace",
  next: "next",
  previous: "previous",
  all: "all",
  "match case": "matchCase",
  regexp: "regexp",
  "by word": "byWord",
  replace: "replaceOne",
  "replace all": "replaceAll",
  close: "close",
  "current match": "currentMatch",
  "on line": "onLine",
  "replaced $ matches": "replacedMatches",
  "replaced match on line $": "replacedMatchOnLine",
  "Go to line": "goToLine",
  go: "go",
  Diagnostics: "diagnostics",
  "No diagnostics": "noDiagnostics",
  Completions: "completions",
  "Selection deleted": "selectionDeleted",
  "folded code": "foldedCode",
  unfold: "unfold",
  "Fold line": "foldLine",
  "Unfold line": "unfoldLine",
  "Folded lines": "foldedLines",
  "Unfolded lines": "unfoldedLines",
  to: "to",
  "Control character": "controlCharacter",
} as const;

/** The phrases in the current language; reconfigure when it changes. */
export function editorPhrases() {
  return EditorState.phrases.of(
    Object.fromEntries(Object.entries(KEYS).map(([phrase, key]) => [phrase, i18next.t(`editor.codemirror.${key}`)])),
  );
}
