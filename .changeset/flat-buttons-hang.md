---
"@hyperbook/next-watch": patch
---

Fix dev server not starting. With the upgrade to NextJS 13 the parsing of conf property to the next function changed. At the moment we do not need the custom conf, but in the future we probably need to create next.config.js files.
