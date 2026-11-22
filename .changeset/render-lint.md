---
"hyperbook": minor
---

`hyperbook render` can say what is wrong with a page, as `hyperbook lint` would, for hosts that show it in an editor: add `"diagnostics": true` to a render request, ask `{"file": …, "lint": true}` without rendering, or `{"lint": "book"}` for the book as a whole. `hyperbook lint` reads each book once instead of twice, with the same results.
