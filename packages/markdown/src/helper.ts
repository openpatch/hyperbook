import { HyperbookContext } from "@hyperbook/types";
import path from "path";
import fs from "fs";
import { VFile } from "vfile";
import { Node } from "unist";
import { fileWarning } from "./remarkHelper";

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
/** Where a `src` may be in the book, in the order `readFile` tries them. */
const candidatesFor = (src: string, ctx: HyperbookContext) => {
  const directory = ctx.navigation.current?.path?.directory || "";
  const fromRoot = path.posix.resolve("/", src);
  const fromPage = path.posix.resolve("/", directory, src);
  const relative = src.startsWith("./") || src.startsWith("../");
  return [
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
};

/**
 * The file a `src` names, found like `readFile` finds it but not read: its
 * path relative to the book's root (`book/a/b.typ`, posix) and the address
 * it has in the site (`/a/b.typ`). Null when there is none.
 */
export const resolveFile = (
  src: string,
  ctx: HyperbookContext,
): { relative: string; href: string } | null => {
  for (const candidate of candidatesFor(src, ctx)) {
    ctx.dependencies?.add(candidate);
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(candidate);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const relative = path
      .relative(ctx.root, candidate)
      .split(path.sep)
      .join("/");
    // book/ and public/ are both served from the site's root.
    const href = "/" + relative.split("/").slice(1).join("/");
    return { relative, href };
  }
  return null;
};

export const readFile = (src: string, ctx: HyperbookContext) => {
  const candidates = candidatesFor(src, ctx);

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

/** URLs that are not the book's to look for. */
const NOT_A_BOOK_FILE = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Warns when an element's file attribute (`src`, `poster`, …) names a file
 * that is not in the book.
 *
 * Elements turn these into URLs without looking, so a misspelled video or a
 * PDF that was never copied in builds cleanly and only fails in the reader's
 * browser. Looked for where `readFile` looks; addresses on other sites are
 * not checked.
 */
export const expectFile = (
  file: VFile,
  ctx: HyperbookContext,
  node: Node,
  element: string,
  attribute: string,
  src: unknown,
) => {
  if (typeof src !== "string") return;
  const target = src.trim().split(/[?#]/)[0]!;
  if (!target || NOT_A_BOOK_FILE.test(src.trim())) return;
  if (resolveFile(target, ctx)) return;
  // The build zips archives/<name>/ into /archives/<name>.zip.
  const archive = target.match(/^\/?archives\/([^/]+)\.zip$/);
  if (archive && fs.existsSync(path.join(ctx.root, "archives", archive[1]!)))
    return;
  fileWarning(
    file,
    "missing-file",
    `${element} ${attribute}="${src}" was not found. Put the file in public/ ` +
      `or next to the page and check the spelling, or give a full https:// address.`,
    node,
  );
};
