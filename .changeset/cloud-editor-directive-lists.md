---
"@hyperbook/cloud": patch
---

Markdown lists in the editor were highlighted in the same grey italic as comments, which also swallowed the link color of links inside list items; lists now use the normal text color again and links keep their own color. Container directives (`:::p5 … :::`) are now foldable: the fold gutter and the fold keymap fold a directive from its opening line through its closing line, with nested directives folding independently.
