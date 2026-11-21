import { VFile } from "vfile";

/**
 * How a row's key relates to its element's id: equal to it (`id`, the
 * default), starting with it (`prefix`: an embedded IDE keeps one row per
 * file, keyed id + file name), or ending with it (`suffix`).
 */
export type KeyMatch = "id" | "prefix" | "suffix";

/** Where one directive keeps a reader's work. */
interface StoreSpec {
  table: string;
  match?: KeyMatch;
  /** More tables of the same element, e.g. the SQL IDE's changed database. */
  also?: { table: string; match: KeyMatch }[];
}

/**
 * Where each directive keeps a reader's work, keyed by the directive's id
 * (`resolveDirectiveId`, or the author's `id=`). Only directives whose
 * client writes rows keyed by that id are listed; UI state (tabs,
 * collapsibles, slideshows, audio positions) is left out on purpose.
 */
export const STORE_OF_DIRECTIVE: Readonly<Record<string, StoreSpec>> = {
  textinput: { table: "textinput" },
  learningmap: { table: "learningmap" },
  struktolab: { table: "struktolab" },
  jmp: { table: "jmp" },
  bitflow: { table: "bitflow" },
  geogebra: { table: "geogebra" },
  multievent: { table: "multievent" },
  // ```abcjs editor: the tune a reader edited.
  "abc-music": { table: "abcMusic" },
  // A GFM task-list item ("- [ ] …"), saved by bootstrap.js under
  // markdown-checklist:<page path>:<item id>, so matched by its end.
  checklist: { table: "checklist", match: "suffix" },
  // directive-h5p/client.js: db.h5p.put({ id, userData }) under data-id.
  h5p: { table: "h5p" },
  // packages/web-component-excalidraw: db.excalidraw.put({ id, … })
  excalidraw: { table: "excalidraw" },
  // The IDEs on the shared IDE shell (ide-bundle) share one table, one row
  // per element with all its files.
  pyide: { table: "ide" },
  p5: { table: "ide" },
  openscad: { table: "ide" },
  typst: { table: "ide" },
  webide: { table: "ide" },
  // The embedded Online-IDE and SQL-IDE (their own repositories) keep the
  // file list under the id and each file under id + file name.
  onlineide: { table: "onlineide", match: "prefix" },
  sqlide: {
    table: "sqlideScripts",
    match: "prefix",
    // The statements that changed the database, under database URL + id.
    also: [{ table: "sqlideDatabases", match: "suffix" }],
  },
};

/** The table of each directive in STORE_OF_DIRECTIVE. */
export const STORE_TABLE_OF_DIRECTIVE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STORE_OF_DIRECTIVE).map(([name, spec]) => [name, spec.table]),
);

/** One element of a page that keeps a reader's work. */
export interface StoredElement {
  /** The directive's id, the row key in its table (see `match`). */
  id: string;
  /** The directive's name, e.g. "textinput". */
  name: string;
  /** The store table the row lives in. */
  table: string;
  /** Left out when the key is the id itself. */
  match?: Exclude<KeyMatch, "id">;
  also?: { table: string; match: KeyMatch }[];
}

/**
 * Called by each directive of STORE_OF_DIRECTIVE once its id is final,
 * whether the author gave it (`id=`) or it was derived.
 */
export function recordStoredElement(
  file: VFile,
  name: string,
  id: string | null | undefined,
  node: { position?: { start: { offset?: number } } },
) {
  const spec = STORE_OF_DIRECTIVE[name];
  if (!spec || !id) return;
  const list = (file.data.storedElements ||= []);
  if (list.some((e) => e.table === spec.table && e.id === id)) return;
  const element: StoredElement = { id, name, table: spec.table };
  if (spec.match && spec.match !== "id") element.match = spec.match;
  if (spec.also) element.also = spec.also;
  // Each directive's plugin runs on its own, so the order is restored from
  // the source position when the list is read.
  list.push({ ...element, at: node.position?.start.offset ?? 0 });
}

/**
 * The elements of a processed page that save a reader's work, in document
 * order. A platform uses this to show a teacher which element a saved row
 * belongs to.
 */
export function storedElements(file: Pick<VFile, "data">): StoredElement[] {
  return [...(file.data.storedElements || [])]
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...element }) => element);
}
