import type { Root, Paragraph, Text, Image } from "mdast";
import { visit } from "unist-util-visit";
import { HyperbookContext } from "@hyperbook/types/dist";

type Attrs = Record<string, string>;

const ATTR_BLOCK_RE = /^\s*\{([\s\S]*?)\}/;
const ATTR_PAIR_RE = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/g;
const SHORTHAND_RE = /([#.])([\w-]+)/g;

function parseAttrBlock(
  input: string,
): { attrs: Attrs; length: number } | null {
  const m = ATTR_BLOCK_RE.exec(input);
  if (!m) return null;
  const inner = m[1];
  const attrs: Attrs = {};
  let classes: string[] = [];

  // key=val
  let pair: RegExpExecArray | null;
  while ((pair = ATTR_PAIR_RE.exec(inner)) !== null) {
    const key = pair[1];
    const val = pair[2] ?? pair[3] ?? pair[4] ?? "";
    attrs[key] = val;
  }

  // shorthand
  let sm: RegExpExecArray | null;
  while ((sm = SHORTHAND_RE.exec(inner)) !== null) {
    if (sm[1] === "#") {
      attrs["id"] = sm[2];
    } else if (sm[1] === ".") {
      classes.push(sm[2]);
    }
  }
  if (classes.length > 0) {
    attrs["class"] = classes.join(" ");
  }

  return { attrs, length: m[0].length };
}

function detectAlignment(
  prev: Text | undefined,
  next: Text | undefined,
): string {
  let left = prev?.value.endsWith("-")
    ? (prev.value.match(/-+$/)?.[0] ?? "")
    : "";
  let right = next?.value.startsWith("-")
    ? (next.value.match(/^-+/)?.[0] ?? "")
    : "";

  if (left === "-" && !right) return "align-left";
  if (left === "--" && !right) return "align-leftplus";
  if (right === "-" && !left) return "align-right";
  if (right === "--" && !left) return "align-rightplus";
  if (left === "--" && right === "--") return "align-centerplus";
  return ""; // default
}

const remarkImageAttrs = (ctx: HyperbookContext) => () => {
  return (tree: Root) => {
    visit(tree, "paragraph", (para: Paragraph) => {
      const children = para.children;
      for (let i = 0; i < children.length; i++) {
        const img = children[i] as Image;
        if (!img || img.type !== "image") continue;

        const prev = children[i - 1] as Text | undefined;
        const next = children[i + 1] as Text | undefined;

        // Alignment
        const alignClass = detectAlignment(prev, next);

        img.data ||= {};
        img.data!.hProperties ||= {};
        const hProps = img.data!.hProperties as Record<string, unknown>;

        if (alignClass !== "") {
          // 1. Extract existing classes
          const existing = (hProps.class as string)?.split(" ") ?? [];

          // 2. Remove any previous alignment class
          const filtered = existing.filter((c) => !c.startsWith("align-"));

          // 3. Add the new alignment class
          hProps.class = [...filtered, alignClass].join(" ");
        }

        // Trim consumed markers
        if (prev && prev.type === "text" && prev.value.endsWith("-")) {
          prev.value = prev.value.replace(/-+$/, "");
          if (prev.value === "") children.splice(i - 1, 1);
          i--; // adjust index
        }
        if (next && next.type === "text" && next.value.startsWith("-")) {
          next.value = next.value.replace(/^-+/, "");
          if (next.value === "") children.splice(i + 1, 1);
        }

        // Attribute block immediately after image
        const nextAfter = children[i + 1] as Text;
        if (nextAfter && nextAfter.type === "text") {
          const parsed = parseAttrBlock(nextAfter.value);
          if (parsed) {
            for (const [k, v] of Object.entries(parsed.attrs)) {
              hProps[k] = v;
            }
            const remainder = nextAfter.value.slice(parsed.length);
            if (remainder.length > 0) {
              nextAfter.value = remainder;
            } else {
              children.splice(i + 1, 1);
            }
          }
        }
      }
    });
  };
};

export default remarkImageAttrs;
