---
"@hyperbook/fs": patch
"@hyperbook/cloud": patch
---

Preview rendering is no longer slow on large books. A page render of the editor's preview re-read and re-parsed every page of the book (three times over, plus a regex scan of every page per glossary term); pages and hyperbook.json are now cached by their modification times, the glossary's references are collected in one scan per page, and the directory walks stat only what they must. A save no longer re-checks out every file of the book: the preview's checkout is brought to the new commit by writing only what changed, which also keeps the caches warm. For a 4,000-file book, a preview render drops from ~4 s to ~0.3 s, and the checkout behind a save from rewriting every file to writing the one that changed.
