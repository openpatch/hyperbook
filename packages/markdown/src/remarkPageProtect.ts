/// <reference types="mdast-util-directive" />
import { HyperbookContext, ProtectReference } from "@hyperbook/types";
import { Root } from "mdast";
import { VFile } from "vfile";
import { i18n } from "./i18n";

/** Splits the string and object forms of `protect:` into its two fields. */
export const readProtectReference = (
  reference: ProtectReference,
): { use?: string; password?: string; description?: string } =>
  typeof reference === "string" ? { use: reference } : reference;

/**
 * Wraps a page whose frontmatter sets `protect` in a synthetic `:::protect`
 * container.
 *
 * Page protection is expressed in terms of the block directive rather than as
 * a parallel mechanism, so it inherits everything that already works there:
 * the same markup, the same encryption in rehypeProtect, the same client.
 *
 * Runs immediately before remarkDirectiveProtect, which then treats the
 * wrapper like any other protect block.
 */
export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const page = ctx.navigation.current;
    if (!page?.protect) return;
    if (tree.children.length === 0) return;

    const { use, password, description } = readProtectReference(page.protect);
    const protectedBy = page.protectSource ?? page.href;

    tree.children = [
      {
        type: "containerDirective",
        name: "protect",
        attributes: {
          // Keyed on whatever declared the protection, not on this page. Pages
          // that inherited from a section therefore share one unlock: entering
          // a section's password opens the whole section instead of every page
          // asking again for the same password.
          //
          // The href goes through makeUrl so the basePath is part of it. The
          // books of a hyperlibrary share one origin, and therefore one store,
          // so two translations of a page would otherwise unlock each other.
          id: `page:${
            protectedBy ? ctx.makeUrl(protectedBy, "book") : file.path || page.name
          }`,
          ...(use ? { use } : {}),
          ...(password ? { password } : {}),
          description: description ?? i18n.get("protect-page-description"),
        },
        children: tree.children as any,
      } as any,
    ];
  };
};
