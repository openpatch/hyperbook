import { HyperbookContext } from "@hyperbook/types";
import path from "path";
import fs from "fs";

/**
 * Reads a file referenced by a directive's `src` attribute and inlines it.
 *
 * The candidate paths are tried in order; every one of them is recorded as a
 * dependency, not just the one that resolved. A file that does not exist yet is
 * still a dependency: creating it later has to rebuild this page, and without
 * the misses the dev server would never notice.
 */
export const readFile = (src: string, ctx: HyperbookContext) => {
  const candidates = [
    path.join(ctx.root, "public", src),
    path.join(ctx.root, "book", src),
    path.join(
      ctx.root,
      "book",
      ctx.navigation.current?.path?.directory || "",
      src,
    ),
  ];

  for (const candidate of candidates) {
    ctx.dependencies?.add(candidate);
    try {
      return fs.readFileSync(candidate, "utf-8");
    } catch (e) {
      // Try the next location.
    }
  }

  // File not found in any location
  return null;
};
