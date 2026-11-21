---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Multievent saves a reader's state under its directive id (from `id=` or derived from its content) instead of its position on the page, like the other elements. Adding a multievent above another no longer moves saved state to the wrong one, and Hyperbook Cloud's class view shows multievents. A state saved the old way is moved to the new key the first time the page is opened.
