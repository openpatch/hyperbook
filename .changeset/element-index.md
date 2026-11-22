---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Books with `cloud` get `_hyperbook/elements.json` when they are built: every page with elements that keep a reader's work (text inputs, IDEs, structograms, learning maps, …), in the book's order, with each element's id and store table. Hyperbook Cloud uses it to show teachers what their students worked on. `@hyperbook/markdown` exports `storedElements()` for a processed page.
