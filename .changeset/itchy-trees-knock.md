---
"@hyperbook/markdown": patch
"hyperbook-studio": patch
---

Optimize line breaks. We now insert an optional word break point into links. So the browser knows when to break it. For this we follow this guide: https://css-tricks.com/better-line-breaks-for-long-urls/. This does also fix issue #451
