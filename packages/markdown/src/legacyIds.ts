import { HyperbookContext } from "@hyperbook/types";
import { Element, Root } from "hast";
import remarkToRehype from "remark-rehype";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { resolveDirectiveId } from "./directiveId";
import { remark } from "./process";

/**
 * The ids p5 directives had while p5 was a rehype plugin.
 *
 * The old plugin derived a p5's id from its hast element, after the whole
 * remark stage. p5 is a remark plugin now and hashes the mdast node, so every
 * id changed. `hyperbook migrate` pins the old ids; this reproduces them by
 * running the remark stage without the new plugin and hashing the elements
 * the old one saw.
 */
export const legacyP5Ids = async (
  content: string,
  ctx: HyperbookContext,
): Promise<{ name: string; start: number; end: number; id: string }[]> => {
  const processor = remark(ctx, { withoutP5: true }).use(remarkToRehype, {
    allowDangerousHtml: ctx.config.allowDangerousHtml || false,
  });
  const file = new VFile({ value: content });
  const tree = (await processor.run(processor.parse(file), file)) as Root;

  const ids: { name: string; start: number; end: number; id: string }[] = [];
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "p5") return;
    const explicit = node.properties?.id;
    const id =
      typeof explicit === "string" ? explicit : resolveDirectiveId(file, node);
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      ids.push({ name: "p5", start, end, id });
    }
  });
  return ids;
};
