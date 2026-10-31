---
"@hyperbook/cloud": patch
---

Editor: the quick open dialog's search (Ctrl/Cmd+P) is now fuzzy, the way editors like VS Code do it: a query matches a path when all its characters appear in it in order, so "sovh" finds "sortierverfahren.md" without typing the whole word. Results rank by how well they match — characters typed together, matches at word starts, and matches in the file name rather than its folders score highest — and the matched characters are highlighted wherever they sit, in the file name or in a folder.
