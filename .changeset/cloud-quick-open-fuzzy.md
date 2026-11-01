---
"@hyperbook/cloud": patch
---

Editor: the quick open dialog's search (Ctrl/Cmd+P) is now fuzzy, powered by a port of fzf's V2 algorithm (fzf's "path" scheme): a query matches a path when all its characters appear in it in order, so "sovh" finds "sortierverfahren.md" without typing the whole word. Results are ranked with fzf's scoring — matches at word boundaries, consecutive characters, and camelCase humps score best, with fzf's default tiebreaks — plus one file-picker rule: matches in the file name outrank matches in a folder. The matched characters are highlighted wherever they sit, in the file name or in a folder, readable in dark mode too.
