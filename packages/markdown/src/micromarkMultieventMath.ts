// @ts-nocheck
import type { Extension, State, Effects, Code } from "micromark-util-types";
import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import type { Root } from "mdast";

/**
 * The math field marker `{m{…}}` of a multievent holds LaTeX, and LaTeX is
 * full of characters markdown would act on: `\,` and `\{` are markdown
 * escapes, `x_{1}` and `x^{2}` are Hyperbook's sub- and superscript, `a*b*c`
 * is emphasis. Read as markdown, `{m{1\,5}}` would arrive as `1,5`.
 *
 * This construct reads the marker verbatim instead, braces balanced, so
 * `{m{\frac{1}{2}}}` closes at its own `}}`. It yields a `multieventMath`
 * node with the LaTeX as its value; `multieventMathNodes` turns it into the
 * element the multievent compiler builds the math field from — or, outside a
 * multievent, back into the text it was written as.
 */

const isLineEnding = (code: Code) =>
  code === null || code === -5 || code === -4 || code === -3;

function tokenize(effects: Effects, ok: State, nok: State): State {
  let depth = 0;
  let empty = true;
  return start;

  function start(code: Code): State {
    if (code !== 123 /* { */) return nok(code);
    effects.enter("multieventMath");
    effects.enter("multieventMathMarker");
    effects.consume(code);
    return letter;
  }

  function letter(code: Code): State {
    if (code !== 109 /* m */) return nok(code);
    effects.consume(code);
    return opening;
  }

  function opening(code: Code): State {
    if (code !== 123 /* { */) return nok(code);
    effects.consume(code);
    effects.exit("multieventMathMarker");
    effects.enter("multieventMathValue");
    return inside;
  }

  function inside(code: Code): State {
    if (isLineEnding(code)) return nok(code);
    if (code === 92 /* \ */) {
      empty = false;
      effects.consume(code);
      return escaped;
    }
    if (code === 125 /* } */ && depth === 0) {
      if (empty) return nok(code);
      effects.exit("multieventMathValue");
      effects.enter("multieventMathMarker");
      effects.consume(code);
      return closing;
    }
    if (code === 123 /* { */) depth++;
    if (code === 125 /* } */) depth--;
    empty = false;
    effects.consume(code);
    return inside;
  }

  function escaped(code: Code): State {
    if (isLineEnding(code)) return nok(code);
    effects.consume(code);
    return inside;
  }

  function closing(code: Code): State {
    if (code !== 125 /* } */) return nok(code);
    effects.consume(code);
    effects.exit("multieventMathMarker");
    effects.exit("multieventMath");
    return ok;
  }
}

export const micromarkMultieventMath: Extension = {
  text: { 123: { name: "multieventMath", tokenize } },
};

export const mdastMultieventMath: MdastExtension = {
  enter: {
    multieventMath(token) {
      this.enter({ type: "multieventMath", value: "" }, token);
    },
  },
  exit: {
    multieventMathValue(token) {
      this.stack[this.stack.length - 1].value = this.sliceSerialize(token);
    },
    multieventMath(token) {
      this.exit(token);
    },
  },
};

/** The tag the compiler (rehypeMultievent) builds a math field from. */
export const MATH_SOURCE_TAG = "multievent-math";

/**
 * Settles the `multieventMath` nodes of a parsed page: inside a multievent
 * they become `multievent-math` elements carrying the LaTeX; anywhere else
 * they go back to plain text, merged with the text around them, as if the
 * construct had never matched.
 */
export function multieventMathNodes(tree: Root): void {
  const walk = (node: any, inside: boolean) => {
    if (!Array.isArray(node.children)) return;
    const within =
      inside ||
      (node.type === "containerDirective" && node.name === "multievent");

    const children: any[] = [];
    // Appends a text node, merged into a text node right before it.
    const pushText = (text: any) => {
      const previous = children[children.length - 1];
      if (previous?.type !== "text") {
        children.push(text);
        return;
      }
      previous.value += text.value;
      if (previous.position && text.position)
        previous.position = {
          start: previous.position.start,
          end: text.position.end,
        };
    };

    let reverted = false;
    for (const child of node.children) {
      if (child.type === "multieventMath") {
        if (within) {
          child.data = {
            hName: MATH_SOURCE_TAG,
            hProperties: { latex: child.value },
          };
          children.push(child);
          reverted = false;
        } else {
          pushText({
            type: "text",
            value: `{m{${child.value}}}`,
            position: child.position,
          });
          reverted = true;
        }
        continue;
      }
      // Text right after a reverted marker joins it, as one text node.
      if (reverted && child.type === "text") {
        pushText(child);
        reverted = false;
        continue;
      }
      reverted = false;
      walk(child, within);
      children.push(child);
    }
    node.children = children;
  };
  walk(tree, false);
}
