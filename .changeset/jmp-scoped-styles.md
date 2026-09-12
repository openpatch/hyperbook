---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Update the Java Memory Playground to 0.3.1, which confines its stylesheet to the playground. The
component's bundle is linked into any page carrying a `:jmp` directive, and its rules were unscoped
— `.sidebar` in particular, which resized the book's own navigation on every page with a diagram.
