import { VFile } from "vfile";

/**
 * The store table each directive keeps a reader's work in, keyed by the
 * directive's id (`resolveDirectiveId`). Only directives whose client writes
 * `db.<table>.put({ id, … })` with that id are listed; UI state (tabs,
 * collapsibles, slideshows, audio positions) is left out on purpose.
 */
export const STORE_TABLE_OF_DIRECTIVE: Readonly<Record<string, string>> = {
  textinput: "textinput",
  learningmap: "learningmap",
  struktolab: "struktolab",
  jmp: "jmp",
  bitflow: "bitflow",
  geogebra: "geogebra",
  // The single-file IDEs share one table since store v11.
  pyide: "ide",
  p5: "ide",
  openscad: "ide",
  typst: "ide",
};

/** One element of a page that keeps a reader's work. */
export interface StoredElement {
  /** The directive's id, the row key in its table. */
  id: string;
  /** The directive's name, e.g. "textinput". */
  name: string;
  /** The store table the row lives in. */
  table: string;
}

/**
 * Called by each directive of STORE_TABLE_OF_DIRECTIVE once its id is
 * final, whether the author gave it (`id=`) or it was derived.
 */
export function recordStoredElement(
  file: VFile,
  name: string,
  id: string | null | undefined,
  node: { position?: { start: { offset?: number } } },
) {
  const table = STORE_TABLE_OF_DIRECTIVE[name];
  if (!table || !id) return;
  const list = (file.data.storedElements ||= []);
  if (!list.some((e) => e.table === table && e.id === id)) {
    // Each directive's plugin runs on its own, so the order is restored
    // from the source position when the list is read.
    list.push({ id, name, table, at: node.position?.start.offset ?? 0 });
  }
}

/**
 * The elements of a processed page that save a reader's work, in document
 * order. A platform uses this to show a teacher which element a saved row
 * belongs to.
 */
export function storedElements(file: Pick<VFile, "data">): StoredElement[] {
  return [...(file.data.storedElements || [])]
    .sort((a, b) => a.at - b.at)
    .map(({ id, name, table }) => ({ id, name, table }));
}
