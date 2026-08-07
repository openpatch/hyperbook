import { Plugin } from "unified";
import { Element, ElementContent, Parent, Root, Text } from "hast";
import { HyperbookContext } from "@hyperbook/types";
import { VFile } from "vfile";

import emojiAssets from "./emoji-assets.json";

const availableEmojis = new Set<string>(emojiAssets);

/**
 * Elements whose text is never emoji: replacing a character inside them would
 * either break the code that is being shown or the script that is running.
 */
const skippedTags = new Set([
  "pre",
  "code",
  "script",
  "style",
  "textarea",
  "title",
]);

const VS16 = "\\uFE0F";
const ZWJ = "\\u200D";
const MODIFIER = "\\p{Emoji_Modifier}";
const PICTOGRAPHIC = "\\p{Extended_Pictographic}";
/** Tag sequence, used by the subdivision flags (England, Scotland, Wales). */
const TAG = "(?:[\\u{E0020}-\\u{E007E}]+\\u{E007F})";
/** A single emoji, which may be a flag, or a base with a modifier or a tag. */
const ELEMENT = `(?:\\p{RI}\\p{RI}|${PICTOGRAPHIC}(?:${MODIFIER}|${VS16})?${TAG}?)`;
/** Keycaps are built from plain digits, so they need their own rule. */
const KEYCAP = `(?:[0-9#*]${VS16}?\\u20E3)`;

const emojiPattern = new RegExp(
  `${KEYCAP}|(?:${ELEMENT}(?:${ZWJ}${ELEMENT})*)`,
  "gu",
);

/**
 * Extended_Pictographic also covers characters that are text by default, like
 * © or ™. Those should only become an image when the author asked for the
 * emoji presentation, which is what a variation selector, a keycap or a
 * regional indicator does.
 */
const hasEmojiPresentation = (emoji: string): boolean =>
  emoji.includes("\uFE0F") ||
  emoji.includes("\u20E3") ||
  /^\p{Emoji_Presentation}/u.test(emoji) ||
  /^\p{RI}/u.test(emoji);

/**
 * Builds the Twemoji file name of an emoji. Twemoji drops the variation
 * selector, unless the emoji is a sequence joined by a zero width joiner.
 */
export const toEmojiId = (emoji: string): string => {
  const codePoints = Array.from(emoji).map((c) => c.codePointAt(0) as number);
  const isSequence = codePoints.includes(0x200d);
  return codePoints
    .filter((codePoint) => isSequence || codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16))
    .join("-");
};

const makeImage = (
  ctx: HyperbookContext,
  emoji: string,
  id: string,
): Element => ({
  type: "element",
  tagName: "img",
  properties: {
    class: "emoji",
    src: ctx.makeUrl(["emoji", `${id}.svg`], "assets"),
    alt: emoji,
    "data-emoji": id,
    draggable: "false",
    loading: "lazy",
    decoding: "async",
    width: 20,
    height: 20,
  },
  children: [],
});

/**
 * Replaces emoji characters with Twemoji images, so a hyperbook looks the same
 * on every platform instead of picking up the emoji font of the reader's
 * operating system.
 */
export const rehypeEmoji: Plugin<[HyperbookContext], Root> =
  (ctx: HyperbookContext) => (tree: Root, file: VFile) => {
    if (ctx.config.elements?.emoji?.style !== "twemoji") {
      return;
    }

    const used = new Set<string>(file.data.emojis || []);

    const splitText = (node: Text): ElementContent[] | null => {
      let children: ElementContent[] | null = null;
      let lastIndex = 0;

      for (const match of node.value.matchAll(emojiPattern)) {
        const emoji = match[0];
        const id = toEmojiId(emoji);
        if (!hasEmojiPresentation(emoji) || !availableEmojis.has(id)) {
          continue;
        }

        if (!children) children = [];
        if (match.index > lastIndex) {
          children.push({
            type: "text",
            value: node.value.slice(lastIndex, match.index),
          });
        }
        children.push(makeImage(ctx, emoji, id));
        used.add(id);
        lastIndex = match.index + emoji.length;
      }

      if (!children) {
        return null;
      }
      if (lastIndex < node.value.length) {
        children.push({ type: "text", value: node.value.slice(lastIndex) });
      }
      return children;
    };

    const walk = (parent: Parent) => {
      const children: ElementContent[] = [];
      let replaced = false;

      for (const child of parent.children as ElementContent[]) {
        if (child.type === "text") {
          const split = splitText(child);
          if (split) {
            children.push(...split);
            replaced = true;
            continue;
          }
        } else if (
          child.type === "element" &&
          !skippedTags.has(child.tagName)
        ) {
          walk(child);
        }
        children.push(child);
      }

      if (replaced) {
        parent.children = children;
      }
    };

    walk(tree);

    if (used.size > 0) {
      file.data.emojis = [...used];
    }
  };

export default rehypeEmoji;
