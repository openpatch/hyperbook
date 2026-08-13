import { VFile } from "vfile";
import hash, { stableHash } from "./objectHash";

/**
 * Derives the storage id for an interactive directive.
 *
 * Directives that persist reader state key it by an id derived from the node
 * when the author does not supply one. That id used to be `hash(node)`, which
 * included the node's `position` — so inserting a paragraph anywhere above a
 * directive changed its id and silently orphaned every reader's saved work.
 *
 * The id is now derived from the directive's content alone. Because two
 * identical directives on one page then collide, repeats are suffixed in
 * document order.
 *
 * The previous id is recorded on the file so the page can ship a mapping and
 * the client can migrate already-stored data exactly once. See `store.js`.
 */
export function resolveDirectiveId(file: VFile, node: unknown): string {
  const legacyId = hash(node);
  const base = stableHash(node);

  const seen = (file.data.directiveIdCounts ||= {});
  const count = (seen[base] = (seen[base] || 0) + 1);
  const id = count === 1 ? base : `${base}-${count}`;

  // An unchanged id needs no migration, and recording it would only grow the
  // mapping the page has to carry.
  if (id !== legacyId) {
    const legacy = (file.data.legacyDirectiveIds ||= {});
    legacy[id] = legacyId;
  }

  return id;
}
