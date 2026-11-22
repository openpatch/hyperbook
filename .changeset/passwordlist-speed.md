---
"@hyperbook/markdown": patch
---

`::passwordlist` is much faster on large books. Pages without a `:::protect` block are no longer parsed, and each page's blocks are kept until its text changes, so a list rendered again (in the dev server or Hyperbook Cloud's preview) only reads the pages that changed: on a book with 728 pages it renders in under a second instead of 9 to 13. A block without a heading or task before it no longer gets the page's frontmatter as its context.
