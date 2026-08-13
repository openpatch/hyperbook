import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";
import { ctx as baseCtx } from "./mock";
import { rehypeEmoji, toEmojiId, toEmojiIds } from "../src/rehypeEmoji";
import githubEmojis from "../src/github-emojis.json";
import emojiAssets from "../src/emoji-assets.json";
import { remarkGithubEmoji } from "../src/remarkGithubEmoji";
import remarkParse from "../src/remarkParse";

const twemojiCtx: HyperbookContext = {
  ...baseCtx,
  config: {
    ...baseCtx.config,
    elements: { ...baseCtx.config.elements, emoji: { style: "twemoji" } },
  },
};

const toHtml = (md: string, ctx: HyperbookContext) => {
  const file = new VFile(md);
  const value = unified()
    .use(remarkParse)
    .use(remarkGithubEmoji)
    .use(remarkToRehype)
    .use(rehypeEmoji, ctx)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(file).value;
  return { html: String(value), file };
};

describe("toEmojiId", () => {
  it("should drop the variation selector", () => {
    expect(toEmojiId("❤️")).toBe("2764");
  });
  it("should keep the variation selector in a joined sequence", () => {
    expect(toEmojiId("❤️‍🔥")).toBe("2764-fe0f-200d-1f525");
  });
  it("should keep skin tone modifiers", () => {
    expect(toEmojiId("👍🏻")).toBe("1f44d-1f3fb");
  });
  it("should build keycaps without the variation selector", () => {
    expect(toEmojiId("1️⃣")).toBe("31-20e3");
  });

  it("should fall back to the stripped spelling when twemoji uses it", () => {
    // Twemoji is not consistent: this sequence is stored with both variation
    // selectors dropped, even though it is joined by a zero width joiner.
    expect(toEmojiIds("👁️‍🗨️")).toEqual([
      "1f441-fe0f-200d-1f5e8-fe0f",
      "1f441-200d-1f5e8",
    ]);
    expect(toEmojiId("👁️‍🗨️")).toBe("1f441-200d-1f5e8");
  });

  it("should return nothing when there is no asset", () => {
    expect(toEmojiId("\u{1FAE9}\u{1FAE9}")).toBeUndefined();
  });
});

describe("the shortcode map", () => {
  const assets = new Set<string>(emojiAssets);
  const entries = Object.entries(githubEmojis as Record<string, string>);

  it("should cover every shortcode with a twemoji asset", () => {
    // The map used to come from GitHub's emoji API, whose image file names
    // drop the ZWJ and the variation selectors. Rebuilding the sequences from
    // those names guessed wrong for flags and keycaps, so a fifth of the
    // shortcodes silently fell back to the reader's system font. This fails if
    // gemoji and @twemoji/svg ever drift apart again.
    const uncovered = entries.filter(
      ([, emoji]) => !toEmojiIds(emoji).some((id) => assets.has(id)),
    );
    expect(uncovered).toEqual([]);
  });

  it("should ask for emoji presentation everywhere", () => {
    // A text-default emoji such as :comet: only becomes an image when the
    // character carries a variation selector, which is what makes the
    // shortcode unambiguous.
    const textDefault = entries.filter(
      ([, emoji]) =>
        !emoji.includes("\uFE0F") &&
        !emoji.includes("\u20E3") &&
        !/^\p{Emoji_Presentation}/u.test(emoji) &&
        !/^\p{RI}/u.test(emoji),
    );
    expect(textDefault).toEqual([]);
  });

  it("should not join flags with a zero width joiner", () => {
    expect(Array.from(githubEmojis.afghanistan)).toHaveLength(2);
    expect(githubEmojis.afghanistan).toBe("🇦🇫");
  });
});

describe("rehypeEmoji", () => {
  it("should replace a shortcode with an image", () => {
    const { html } = toHtml(":penguin:", twemojiCtx);
    expect(html).toContain(`src="/assets/emoji/1f427.svg"`);
    expect(html).toContain(`alt="🐧"`);
    expect(html).toContain(`class="emoji"`);
  });

  it("should tag the image with the emoji id", () => {
    // The id lets the client rebuild the image, for example for a bookmark.
    const { html } = toHtml(":penguin:", twemojiCtx);
    expect(html).toContain(`data-emoji="1f427"`);
  });

  it("should replace an emoji that was typed directly", () => {
    const { html } = toHtml("Hello 🐧 world", twemojiCtx);
    expect(html).toContain(`src="/assets/emoji/1f427.svg"`);
    expect(html).toContain("Hello ");
    expect(html).toContain(" world");
  });

  it("should replace flags, keycaps and joined sequences", () => {
    const { html } = toHtml("🇩🇪 1️⃣ 👩‍💻 👍🏻", twemojiCtx);
    expect(html).toContain(`src="/assets/emoji/1f1e9-1f1ea.svg"`);
    expect(html).toContain(`src="/assets/emoji/31-20e3.svg"`);
    expect(html).toContain(`src="/assets/emoji/1f469-200d-1f4bb.svg"`);
    expect(html).toContain(`src="/assets/emoji/1f44d-1f3fb.svg"`);
  });

  it("should keep characters that are text by default", () => {
    const { html } = toHtml("© 2024 — ½ ‼", twemojiCtx);
    expect(html).not.toContain("<img");
    expect(html).toContain("© 2024");
  });

  it("should keep digits and hashes that are not keycaps", () => {
    const { html } = toHtml("There are 3 issues in #42", twemojiCtx);
    expect(html).not.toContain("<img");
  });

  it("should not touch code", () => {
    const { html } = toHtml("`🐧` and\n\n```\n🐧\n```\n", twemojiCtx);
    expect(html).not.toContain("<img");
    expect(html).toContain("🐧");
  });

  it("should record the used emojis on the file", () => {
    const { file } = toHtml(":penguin: :penguin: :apple:", twemojiCtx);
    expect(file.data.emojis?.sort()).toEqual(["1f34e", "1f427"]);
  });

  it("should walk past an element without children", () => {
    // Directives build hast by hand and may leave children out entirely.
    const tree: any = {
      type: "root",
      children: [
        { type: "element", tagName: "img", properties: { src: "/a.png" } },
        { type: "text", value: "🐧" },
      ],
    };
    const file = new VFile("");
    expect(() => (rehypeEmoji as any)(twemojiCtx)(tree, file)).not.toThrow();
    expect(tree.children[1].tagName).toBe("img");
    expect(tree.children[1].properties["data-emoji"]).toBe("1f427");
  });

  it("should keep emojis as text when the style is native", () => {
    const { html, file } = toHtml(":penguin:", baseCtx);
    expect(html).not.toContain("<img");
    expect(html).toContain("🐧");
    expect(file.data.emojis).toBeUndefined();
  });
});
