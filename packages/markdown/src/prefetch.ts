import path from "path";
import { readText } from "@hyperbook/fs";
import { HyperbookContext } from "@hyperbook/types";

/**
 * Where a `src` of a directive can be, in the order it is tried. Shared with
 * the reader below, so both look in the same places.
 */
export const candidates = (src: string, ctx: HyperbookContext): string[] => [
  path.join(ctx.root, "public", src),
  path.join(ctx.root, "book", src),
  path.join(
    ctx.root,
    "book",
    ctx.navigation.current?.path?.directory || "",
    src,
  ),
];

const srcAttribute = /\bsrc=(?:"([^"]+)"|'([^']+)')/g;
const snippetFormat = /\bformat=(?:"#([^"]+)"|'#([^']+)')/g;

/**
 * Reads the files a page inlines before the page is processed.
 *
 * Directives inline a file while the tree is walked, which is synchronous, so
 * on a host whose file system is asynchronous they cannot read it themselves.
 * Their content is put on the context here instead. Which files a page wants is
 * read off the markdown, so this stays a plain scan and does not need the tree.
 *
 * A file that fails to read is skipped: the directive reports it, the same way
 * it did when it read the file itself.
 */
export const prefetchFiles = async (
  md: string,
  ctx: HyperbookContext,
): Promise<void> => {
  const wanted = new Set<string>();

  for (const match of md.matchAll(srcAttribute)) {
    for (const candidate of candidates(match[1] ?? match[2], ctx)) {
      wanted.add(candidate);
    }
  }
  for (const match of md.matchAll(snippetFormat)) {
    wanted.add(
      path.join(ctx.root, "snippets", `${match[1] ?? match[2]}.md.hbs`),
    );
  }

  if (wanted.size === 0) {
    return;
  }

  const files = ctx.files || (ctx.files = new Map());
  await Promise.all(
    [...wanted].map(async (candidate) => {
      try {
        files.set(candidate, await readText(candidate));
      } catch {
        // Not every candidate exists. The reader falls through to the next.
      }
    }),
  );
};
