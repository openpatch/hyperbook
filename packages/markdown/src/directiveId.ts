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
 * That suffix is the one thing here that is not stable: it depends on which
 * other directives currently collide. Edit one of two identical directives so
 * that it no longer matches, and the survivor drops from `base-2` back to
 * `base` — which is where the *edited* one used to store its data. No
 * content-derived id can avoid this, because the two directives are by
 * definition indistinguishable, so the author is warned instead and told to
 * pin an explicit `id`.
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

  // Warn once per group, on the first repeat.
  if (count === 2) {
    const name = (node as { name?: string })?.name ?? "directive";
    // No colon prefix in the example: this fires for leaf and container
    // directives alike, and showing the wrong count would be worse than none.
    file.message(
      `Two identical "${name}" directives on this page have to share a generated id. ` +
        `Add an attribute like id="${name}-1" to each — otherwise editing one of ` +
        `them later can move a reader's saved work into the other.`,
      node as never,
    );
  }

  // An unchanged id needs no migration, and recording it would only grow the
  // mapping the page has to carry.
  if (id !== legacyId) {
    const legacy = (file.data.legacyDirectiveIds ||= {});
    legacy[id] = legacyId;
  }

  return id;
}
