import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

/*
 * Completes `#import "@…"` in `.typ` files with the packages a book can
 * import: the instance's shared library and the book's own package folders
 * (any `<namespace>/<name>/<version>/typst.toml` among its files).
 */

let shared: string[] = [];
let own: string[] = [];

/** The instance's packages, as `@namespace/name:version`; set by the editor page. */
export function setSharedTypstImports(imports: string[]) {
  shared = imports;
}

/** The book's own packages, found among its files. */
export function setBookFilesForTypstImports(files: string[]) {
  own = [];
  for (const file of files) {
    const match = /(?:^|\/)([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/(\d+\.\d+\.\d+)\/typst\.toml$/.exec(file);
    if (match && match[1] !== "preview") own.push(`@${match[1]}/${match[2]}:${match[3]}`);
  }
}

function complete(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const match = /#import\s+"(@[^"]*)$/.exec(before);
  if (!match) return null;
  const options = [...new Set([...own, ...shared])].sort().map((label) => ({ label, type: "namespace" }));
  if (options.length === 0) return null;
  return { from: context.pos - match[1]!.length, options, validFor: /^@[\w/:.-]*$/ };
}

/** The completion, for the editor's `.typ` files. */
export const typstImportCompletion = EditorState.languageData.of(() => [{ autocomplete: complete }]);
