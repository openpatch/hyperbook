---
"@hyperbook/cloud": minor
---

The editor highlights more file types: Java, Python, SQL (with SQLite keywords, matching the sqlide element), Typst, plus `jsx`/`tsx`/`cjs` and `htm`/`xhtml`, and it highlights Typst code blocks inside pages. Pages ending in `.md.hbs` count as Markdown pages for spell check, and the new-file dialog mentions them. Builds and renders mark the checkout as the book's project root, so the `rfile`/`rbase64` helpers find the book's root files in the cloud too.
