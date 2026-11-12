/**
 * Unsaved text, kept in the browser (IndexedDB) while typing, so a closed
 * tab, a crash or a lost connection loses nothing: the editor brings it back
 * when the book is opened again. Only this browser has it, and the book's
 * history never sees it; saving is still what makes it part of the book.
 * Every call fails quietly: without IndexedDB (a private window) there are
 * no drafts, and editing works as before.
 */

/** A file's unsaved text and the saved version it was typed on. */
export type Draft = { text: string; baseOid: string; savedAt: number };

const DB_NAME = "hyperbook-drafts";
const STORE = "drafts";

let opened: Promise<IDBDatabase | null> | null = null;

function database(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opened;
}

const key = (bookId: string, path: string) => `${bookId}\n${path}`;

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const db = await database();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const getDraft = (bookId: string, path: string) =>
  run<Draft | undefined>("readonly", (store) => store.get(key(bookId, path)));

export const putDraft = (bookId: string, path: string, draft: Draft) =>
  run("readwrite", (store) => store.put(draft, key(bookId, path))).then(() => {});

export const deleteDraft = (bookId: string, path: string) =>
  run("readwrite", (store) => store.delete(key(bookId, path))).then(() => {});

/** The files of a book that have a draft. */
export async function draftPaths(bookId: string): Promise<string[]> {
  const prefix = `${bookId}\n`;
  const keys =
    (await run("readonly", (store) =>
      store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)),
    )) ?? [];
  return keys.map((k) => String(k).slice(prefix.length));
}

/** Drafts of large binary files (a .sb3 as base64) are not kept. */
export const MAX_DRAFT_LENGTH = 4 * 1024 * 1024;
