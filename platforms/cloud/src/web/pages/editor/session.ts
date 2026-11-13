/**
 * Where you left off in a book, kept in this browser (localStorage): the open
 * tabs, the active one and the unfolded folders of the file tree. A refresh
 * or coming back later finds the editor as it was. Every call fails quietly:
 * without storage (a private window) the editor starts fresh, as before.
 */

/** The open tabs, in order, and the one shown. */
export type Tabs = { paths: string[]; active: string | null };

const tabsKey = (bookId: string) => `hb-editor-tabs-${bookId}`;
const foldersKey = (bookId: string) => `hb-editor-folders-${bookId}`;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No storage, or it is full: the editor starts fresh next time.
  }
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

/** The tabs open last time, or null when nothing was kept. */
export function loadTabs(bookId: string): Tabs | null {
  const value = read(tabsKey(bookId)) as Partial<Tabs> | null;
  if (!value || !isStrings(value.paths)) return null;
  return {
    paths: value.paths,
    active: typeof value.active === "string" ? value.active : null,
  };
}

export function saveTabs(bookId: string, tabs: Tabs) {
  write(tabsKey(bookId), tabs);
}

/**
 * The folders unfolded last time, or null when nothing was kept. The
 * unfolded ones are kept, not the folded ones, so a folder added since
 * starts folded like every folder of a book opened for the first time.
 */
export function loadOpenFolders(bookId: string): string[] | null {
  const value = read(foldersKey(bookId));
  return isStrings(value) ? value : null;
}

export function saveOpenFolders(bookId: string, folders: string[]) {
  write(foldersKey(bookId), folders);
}
