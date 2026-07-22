---
"@hyperbook/markdown": patch
"@hyperbook/fs": patch
"@hyperbook/types": patch
"hyperbook": patch
---

**dev**: The dev server now tracks which files each page inlines, so a change rebuilds exactly the pages that used it.

Editing a file referenced by a directive's `src=` attribute previously reloaded the browser without rebuilding anything, so the page came back showing the old content — and for a file under `book/` nothing happened at all. Snippets and templates are now mapped to the pages that use them instead of forcing a full rebuild of the book.

Two related fixes: renaming a page or changing its order rebuilds every page, because the navigation is baked into all of them and the rest were left showing the old title; and the search index is regenerated after an incremental build instead of going stale until the next full build.
