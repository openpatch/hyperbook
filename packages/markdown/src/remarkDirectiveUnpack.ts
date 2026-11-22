// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { CHILD_DIRECTIVES, suggestDirective } from "./directiveNames";

const COLONS = {
  textDirective: ":",
  leafDirective: "::",
  containerDirective: ":::",
} as const;

/**
 * Explains why an unclaimed directive is a problem, or returns undefined when
 * it is not one.
 *
 * Unpacking keeps only `:name`; the label, attributes and body are dropped. A
 * bare text directive loses nothing, and prose is full of them by accident —
 * `Lehrer:innen`, `10:30` — so those stay quiet. Anything else lost content
 * the author wrote.
 */
function unknownDirectiveReason(
  node: TextDirective | LeafDirective | ContainerDirective,
): string | undefined {
  const hasAttributes = Object.keys(node.attributes || {}).length > 0;
  const hasContent = node.children.length > 0;
  if (node.type === "textDirective" && !hasAttributes && !hasContent) {
    return undefined;
  }

  const written = `${COLONS[node.type]}${node.name}`;
  const parent = CHILD_DIRECTIVES[node.name];
  if (parent) {
    return `"${written}" only works directly inside ${parent}. Here it is shown as plain text and its content is dropped.`;
  }
  const suggestion = suggestDirective(node.name);
  return (
    `Unknown directive "${written}". It is shown as plain text and its ` +
    `${node.type === "containerDirective" ? "content is" : "label and attributes are"} dropped.` +
    (suggestion ? ` Did you mean "${COLONS[node.type]}${suggestion}"?` : "")
  );
}

/**
 * Nodes below a directive that renders its own `hChildren`. Their mdast never
 * reaches the page — the parent read them already (`::file` inside
 * `:::sqlide`) — so unpacking them loses nothing worth reporting.
 */
function replacedSubtrees(tree: Root): Set<unknown> {
  const hidden = new Set<unknown>();
  const walk = (node: any, inside: boolean) => {
    if (inside) hidden.add(node);
    const replaces = inside || node.data?.hChildren !== undefined;
    for (const child of node.children ?? []) walk(child, replaces);
  };
  walk(tree, false);
  return hidden;
}

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const directives = Object.keys(file.data.directives || {}).flatMap((n) => [
      ...(file.data?.directives?.[n].addditionalDirective || []),
      n,
    ]);
    // TODO move p5 to remark plugins.
    directives.push("p5");
    const hidden = replacedSubtrees(tree);
    visit(tree, (node) => {
      if (
        (node.type === "textDirective" ||
          node.type === "leafDirective" ||
          node.type === "containerDirective") &&
        !directives.includes(node.name)
      ) {
        const reason = hidden.has(node)
          ? undefined
          : unknownDirectiveReason(node);
        if (reason) {
          file.message(reason, {
            place: node.position,
            ruleId: "unknown-directive",
            source: "hyperbook",
          });
        }
        if (node.type === "textDirective") {
          node.value = `:${node.name}`;
        } else if (node.type === "leafDirective") {
          node.value = `::${node.name}`;
        } else if (node.type === "containerDirective") {
          node.value = `:::${node.name}`;
        }
        node.type = "text";
        node.data = {};
      }
    });
  };
};
