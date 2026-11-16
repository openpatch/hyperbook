import { EventEmitter } from "node:events";

/**
 * Tells open editors that a book's main branch moved: an editor save, a git
 * push, a zip upload. The platform is one process (SQLite, one volume), so
 * an in-memory emitter reaches every open event stream
 * (GET /api/books/:id/events); a second process would need a shared bus.
 */
export type BookChange = {
  /** The commit main points at now. */
  commit: string;
  /** Who made it, as the editor shows them; null when unknown. */
  by: string | null;
  via: "editor" | "push" | "upload";
};

const emitter = new EventEmitter();
// One listener per open editor: no limit is the right limit.
emitter.setMaxListeners(0);

export function bookChanged(bookId: number, change: BookChange) {
  emitter.emit(String(bookId), change);
}

/** Calls `listener` on every change of the book; returns the unsubscribe. */
export function onBookChange(bookId: number, listener: (change: BookChange) => void) {
  const key = String(bookId);
  emitter.on(key, listener);
  return () => void emitter.off(key, listener);
}
