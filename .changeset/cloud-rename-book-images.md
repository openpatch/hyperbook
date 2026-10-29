---
"@hyperbook/cloud": patch
---

Renaming or moving an image or other file that sits next to the pages in book/ now finds and updates the links to it, including relative ones like `./image.png`. Relative links stay relative after the rewrite, and a link's `#fragment` is no longer doubled.
