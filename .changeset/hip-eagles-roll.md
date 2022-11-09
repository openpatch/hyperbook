---
"@platforms/web": patch
---

Anchor tags did not work on initial load. We now wait a little to make sure the markdown content is loaded. Then a smooth scroll to the anchor tag will happen.
