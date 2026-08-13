---
"@hyperbook/markdown": patch
---

Fix emoji shortcodes falling back to the reader's system font.

With `elements.emoji.style` set to `twemoji`, 616 of the 1913 shortcodes were
rendered by the operating system instead of as a Twemoji image, so a page mixed
two different emoji styles. Flags, keycaps and text-presentation emoji such as
`:comet:`, `:afghanistan:` and `:asterisk:` were all affected.

The cause was the shortcode map, which was built from GitHub's emoji API. That
API answers with image URLs like `unicode/1f1e6-1f1eb.png`, and those file names
drop the zero width joiner and the variation selectors — so `1f9d1-1f3a8`
(artist, which needs a ZWJ) and `1f1e6-1f1eb` (a flag, which must not have one)
are indistinguishable. The generator inserted a ZWJ between every codepoint,
which happened to be right for sequences and wrong for everything else, and left
text-default emoji without the variation selector that marks them as emoji.

The map is now built from `gemoji`, the same shortcode set, which carries the
actual Unicode sequences. All 1913 shortcodes are unchanged in name, so nothing
that worked before stops working — they now resolve to the correct characters.

Also fixes emoji typed directly into a page: Twemoji keeps the variation
selector in some sequences and drops it in others, so both spellings are tried
rather than guessing the rule. 👁️‍🗨️ was one such case.
