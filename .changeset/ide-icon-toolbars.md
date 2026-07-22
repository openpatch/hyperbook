---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**pyide**, **p5**, **openscad**: The reset, copy, download and fullscreen buttons in the editor toolbar are now inline SVG icons instead of written labels, which wrapped onto several lines in languages with long words. The wording moves to `title` and `aria-label`, so it still shows as a tooltip and is still announced by screen readers.

The same applies to **webide**, **typst** and **abc-music**, and to the remaining directive icons: the download icons in **download** and **archive**, the lock in **protect**, typst's add-file button, and the expand arrows on the binary-file sections of **openscad** and **typst**. Typst's two download buttons now differ — a box for the whole project, an arrow for the PDF.

This also fixes the fullscreen button rendering as an empty box for some readers: it used the glyph `⛶` (U+26F6), which ships in very few fonts. The icons inherit the button's colour, so they follow the light and dark themes.
