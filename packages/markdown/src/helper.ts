import { HyperbookContext } from "@hyperbook/types";
import { nodeSync } from "@hyperbook/fs";
import { candidates } from "./prefetch";

/**
 * Reads a file referenced by a directive's `src` attribute and inlines it.
 *
 * The candidate paths are tried in order; every one of them is recorded as a
 * dependency, not just the one that resolved. A file that does not exist yet is
 * still a dependency: creating it later has to rebuild this page, and without
 * the misses the dev server would never notice.
 */
export const readFile = (src: string, ctx: HyperbookContext) => {
  for (const candidate of candidates(src, ctx)) {
    ctx.dependencies?.add(candidate);

    // Read before processing, where the host has no synchronous file system.
    const prefetched = ctx.files?.get(candidate);
    if (prefetched !== undefined) {
      return prefetched;
    }

    try {
      if (nodeSync) {
        return nodeSync.readFileSync(candidate, "utf8");
      }
    } catch (e) {
      // Try the next location.
    }
  }

  // File not found in any location
  return null;
};
