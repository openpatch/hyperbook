---
"@hyperbook/fs": patch
---

Snippets mentioned in code are no longer expanded. A page explaining snippets, like `` `:::snippet{#aufgabe}` `` in a sentence or a `:::snippet` example in a code block, had the mention replaced by the snippet, which swallowed the text up to the next `:::` and garbled the page. A `:::` in inline code inside a snippet's body no longer ends the snippet early either.
