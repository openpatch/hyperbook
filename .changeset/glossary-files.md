---
"hyperbook": patch
---

Relative links on glossary pages resolve against the glossary page's folder (`./photo.png` on `glossary/term.md` is `/glossary/photo.png`, as the build serves it), also for pages in subfolders and `glossary/index.md`. The dev server copies a changed image (or other file) in `book/` or `glossary/` to the site again; before, only files in `public/` were updated without a full rebuild.
