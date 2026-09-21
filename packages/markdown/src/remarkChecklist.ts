import { ListItem, Root } from "mdast";
import { visit } from "unist-util-visit";
import { stableHash } from "./objectHash";

/**
 * Give every GFM task-list item a content-derived storage id.
 *
 * The authored checked state is intentionally excluded: changing `[ ]` to
 * `[x]` changes the default, not the identity of the task. Position data is
 * excluded by stableHash, so inserting content above a checklist does not
 * orphan a reader's saved progress.
 */
export default function () {
  return function (tree: Root) {
    const occurrences = new Map<string, number>();

    visit(tree, "listItem", (node: ListItem) => {
      if (typeof node.checked !== "boolean") return;

      const base = stableHash({ type: node.type, children: node.children });
      const occurrence = (occurrences.get(base) || 0) + 1;
      occurrences.set(base, occurrence);
      const id = occurrence === 1 ? base : `${base}-${occurrence}`;

      node.data ||= {};
      node.data.hProperties ||= {};
      node.data.hProperties["data-checklist-id"] = id;
    });
  };
}
