---
"@hyperbook/markdown": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Fix the drawers flashing over the page while it loads. A custom element renders
its children until it is upgraded, and a side drawer is only hidden by its
shadow root, so the search drawer and the table of contents drawer painted over
the header and the article until `side-drawer.js` had run.
