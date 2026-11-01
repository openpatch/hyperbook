---
"@hyperbook/cloud": patch
---

Editor: the file sidebar's filter is fuzzy now, like quick open (Ctrl/Cmd+P): typing finds files whose characters appear in the path in order, ranked by fzf's scoring — matches at word boundaries and in the file name first — and the matched characters are highlighted in the results, readable in dark mode too.
