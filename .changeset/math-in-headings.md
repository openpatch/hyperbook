---
"@hyperbook/markdown": minor
---

Math is now rendered in headings. A heading like `## Cost of $x^2$` used to lose the delimiters and show the TeX source as plain text, because a heading is rendered from a single label. The math survives into the heading and is rendered by KaTeX, so `$…$` and `$$…$$` both work next to the heading text. The anchor, the bookmark label and the table of contents keep plain text, as they have no math rendering.
