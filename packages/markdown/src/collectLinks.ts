import { unified } from "unified";
import remarkParse from "./remarkParse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { Root } from "mdast";

export interface LinkTarget {
  /** The URL exactly as the author wrote it. */
  url: string;
  line?: number;
  column?: number;
  kind: "Link" | "Image";
}

/**
 * Finds every link and image target in a markdown source.
 *
 * Deliberately parses with a minimal plugin set rather than reusing `remark`:
 * the render pipeline runs `remarkLink`/`remarkImage`, which rewrite every URL
 * through `makeUrl` before any consumer sees the tree, so the author's original
 * target — the thing worth validating — is no longer present by then.
 *
 * `remark-directive` is included so that directive syntax is consumed as
 * directives rather than being misparsed into stray links.
 */
export function collectLinkTargets(content: string): LinkTarget[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(content) as Root;

  const targets: LinkTarget[] = [];

  visit(tree, (node: any) => {
    if (
      node.type !== "link" &&
      node.type !== "image" &&
      node.type !== "definition"
    ) {
      return;
    }
    if (typeof node.url !== "string") return;

    targets.push({
      url: node.url,
      line: node.position?.start?.line,
      column: node.position?.start?.column,
      kind: node.type === "image" ? "Image" : "Link",
    });
  });

  return targets;
}
