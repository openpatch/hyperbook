---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**pyide**, **p5**, **openscad**: The reset, copy, download and fullscreen buttons in the editor toolbar are now inline SVG icons instead of written labels, which wrapped onto several lines in languages with long words. The wording moves to `title` and `aria-label`, so it still shows as a tooltip and is still announced by screen readers.

This also fixes the fullscreen button rendering as an empty box for some readers: it used the glyph `⛶` (U+26F6), which ships in very few fonts. The icons inherit the button's colour, so they follow the light and dark themes.
