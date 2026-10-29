---
"@hyperbook/cloud": patch
---

Code files in the editor (Java, Python, SQL, …) now use the theme's `--hl-*` syntax colors, which switch with light and dark mode. Before, they fell back to CodeMirror's light-only default highlight style, so e.g. Java source was hard to read in dark mode.
