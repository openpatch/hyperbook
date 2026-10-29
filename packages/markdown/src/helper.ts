import { HyperbookContext } from "@hyperbook/types";
import path from "path";
import fs from "fs";

/**
 * Reads a file referenced by a directive's `src` attribute and inlines it.
 *
 * It is looked for where the page's links lead (see `makeUrl`): "/x" from the
 * book's root, "./x" and "../x" from the page's folder, and a bare "x" in
 * both, the root first. ".." stops at the book's root, so nothing outside the
 * book is read.
 *
 * The candidate paths are tried in order; every one of them is recorded as a
 * dependency, not just the one that resolved. A file that does not exist yet is
 * still a dependency: creating it later has to rebuild this page, and without
 * the misses the dev server would never notice.
 */
export const readFile = (src: string, ctx: HyperbookContext) => {
  const directory = ctx.navigation.current?.path?.directory || "";
  const fromRoot = path.posix.resolve("/", src);
  const fromPage = path.posix.resolve("/", directory, src);
  const relative = src.startsWith("./") || src.startsWith("../");
  const candidates = [
    ...new Set([
      ...(relative
        ? []
        : [
            path.join(ctx.root, "public", fromRoot),
            path.join(ctx.root, "book", fromRoot),
          ]),
      path.join(ctx.root, "book", fromPage),
      path.join(ctx.root, "public", fromPage),
    ]),
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
