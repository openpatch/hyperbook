// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
import { HyperbookContext } from "@hyperbook/types";
import { Paragraph, Root } from "mdast";
import { Point, Position } from "unist";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { suggestDirective } from "./directiveNames";
import { checkAttributes } from "./directiveAttributes";

/*
 * Directive syntax that went wrong before it became a directive.
 *
 * micromark does not report syntax errors: a directive it cannot parse is
 * simply text, and a container nobody closes runs on to the end of the page,
 * swallowing everything after it. Both build without complaint and look
 * broken only to a reader. This plugin looks for the traces they leave.
 *
 * Runs right after `remark-directive`, before any directive is transformed,
 * so the tree still mirrors the source.
 */

/** Strips what puts a line inside a blockquote or list item. */
const CONTAINER_PREFIX = /^[\s>]*/;

const lineAt = (lines: string[], line: number): string =>
  (lines[line - 1] ?? "").replace(CONTAINER_PREFIX, "");

const lineSpan = (line: number, text: string): Position => ({
  start: { line, column: 1 },
  end: { line, column: text.length + 1 },
});

function message(
  file: VFile,
  reason: string,
  place: Position | Point | undefined,
  ruleId: string,
) {
  file.message(reason, { place, ruleId, source: "hyperbook" });
}

/** Checks the lines of a paragraph that should have been directives. */
function checkParagraph(file: VFile, lines: string[], node: Paragraph) {
  if (!node.position) return;
  for (
    let line = node.position.start.line;
    line <= node.position.end.line;
    line++
  ) {
    const raw = lines[line - 1] ?? "";
    // The first line of a paragraph inside a list item starts after "- ".
    const text =
      line === node.position.start.line
        ? raw
            .slice(node.position.start.column - 1)
            .replace(CONTAINER_PREFIX, "")
        : raw.replace(CONTAINER_PREFIX, "");
    const place = lineSpan(line, raw);

    if (/^:{3,}\s*$/.test(text)) {
      message(
        file,
        `Stray "${text.trim()}": there is no open container directive for it to close. ` +
          `Either one was closed already, or its opening line could not be parsed.`,
        place,
        "stray-directive-fence",
      );
      continue;
    }

    const spaced = text.match(/^(:{2,})\s+([A-Za-z][\w-]*)/);
    // Prose may well start a line with ":: Hinweis"; only a directive name
    // (or a near miss) after the space is a directive gone wrong.
    if (spaced && suggestDirective(spaced[2]!)) {
      message(
        file,
        `"${spaced[1]} ${spaced[2]}" is not a directive: there must be no space between the colons and the name. Write "${spaced[1]}${spaced[2]}".`,
        place,
        "malformed-directive",
      );
      continue;
    }

    const leaf = text.match(/^(:{2,})([A-Za-z][\w-]*)/);
    if (leaf) {
      const suggestion = suggestDirective(leaf[2]!);
      // `::std::cout` and the like: only complain about names that are, or
      // nearly are, directives.
      if (!suggestion) continue;
      message(
        file,
        `"${leaf[1]}${leaf[2]}" could not be parsed as a directive and is shown as plain text. ` +
          `Check that [label] and {attributes} follow the name without a space, that brackets ` +
          `and quotes are closed, and that nothing follows the closing "}" on the same line.`,
        place,
        "malformed-directive",
      );
    }
  }
}

/**
 * Finds `:name[label]{…` whose attributes did not parse: micromark keeps the
 * directive without them and leaves the `{…` behind as text right after it.
 */
function checkTrailingAttributes(file: VFile, node: Paragraph) {
  node.children.forEach((child, i) => {
    if (child.type !== "textDirective") return;
    const next = node.children[i + 1];
    if (next?.type !== "text" || !next.value.startsWith("{")) return;
    if (next.position?.start.offset !== child.position?.end.offset) return;
    message(
      file,
      `The {attributes} of ":${child.name}" could not be parsed and are shown as plain text. ` +
        `Check that the "}" is there and that quotes in attributes are closed.`,
      next.position,
      "malformed-directive",
    );
  });
}

export default (_ctx?: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const source = String(file.value ?? "");
    if (!source) return;
    const lines = source.split("\n");

    visit(tree, (node) => {
      if (node.type === "paragraph") {
        checkParagraph(file, lines, node);
        checkTrailingAttributes(file, node);
        return;
      }
      if (
        node.type === "textDirective" ||
        node.type === "leafDirective" ||
        node.type === "containerDirective"
      ) {
        const colons =
          node.type === "textDirective"
            ? ":"
            : node.type === "leafDirective"
              ? "::"
              : ":::";
        for (const problem of checkAttributes(
          `${colons}${node.name}`,
          node.name,
          node.attributes || {},
        )) {
          const options = {
            place: node.position,
            ruleId: problem.ruleId,
            source: "hyperbook",
          };
          if (problem.level === "info") file.info(problem.reason, options);
          else file.message(problem.reason, options);
        }
      }
      if (node.type !== "containerDirective" || !node.position) return;

      // A closed container ends on its fence, which needs at least as many
      // colons as the opening one. Anything else means micromark ran it on
      // to the end of the page or of the enclosing block.
      const opening = lineAt(lines, node.position.start.line).match(/^:{3,}/);
      const closing = lineAt(lines, node.position.end.line).trim();
      const closed =
        node.position.end.line > node.position.start.line &&
        /^:{3,}$/.test(closing) &&
        closing.length >= (opening?.[0].length ?? 3);
      if (closed) return;

      const fence = opening?.[0] ?? ":::";
      message(
        file,
        `"${fence}${node.name}" is never closed, so everything after it up to the end ` +
          `of the page (or of the list or quote it sits in) becomes part of it. ` +
          `Close it with "${fence}" on a line of its own.`,
        node.position.start,
        "unclosed-directive",
      );
    });
  };
};
