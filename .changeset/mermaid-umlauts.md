---
"@hyperbook/markdown": patch
hyperbook: patch
---

**mermaid / pyide**: Diagram labels and test code with non-ASCII characters are
no longer mangled.

A mermaid node labelled `Überwachtes Lernen` rendered as `Ãberwachtes Lernen`,
and the same happened to every umlaut, accent, `ß` and emoji in a diagram. The
text was stored correctly — the directives base64-encode it with `Buffer.from()`,
which writes UTF-8 bytes — but the clients decoded it with a bare `atob()`, which
hands those bytes back one character at a time. `Ü` (C3 9C) arrived as `Ã`
followed by an invisible control character, and mermaid drew exactly that. Both
clients now decode the bytes as UTF-8 before using them.

`pyide` carried the identical bug in its `data-tests` attribute, where it hit
the assertion messages a learner reads when a test fails: `Die Größe muss
größer als 0 sein` arrived as `Die GrÃ¶Ãe muss grÃ¶Ãer als 0 sein`.

Authors who worked around the mermaid case by writing HTML entities
(`vollj&auml;hrig`) can keep them — mermaid still resolves those — or switch
back to plain characters.

**mermaid**: A page with several diagrams no longer stops rendering at the first
one that was already processed. The loop in `loadMermaid` used `return` where it
meant `continue`, so one processed diagram skipped every diagram after it.
