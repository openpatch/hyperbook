---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix several bugs in the pyide directive:

- Fix MutationObserver never initializing dynamically added pyide elements (`node.type` → `node.nodeType`)
- Fix error traceback trimming when `<exec>` is absent from the traceback (`findIndex` returning `-1` no longer silently drops all context)
- Remove hardcoded `id="canvas"` from canvas elements, which caused duplicate HTML IDs on pages with multiple canvas pyides
- Use the page language (`document.documentElement.lang`) for friendly Python error messages instead of always loading English
- Avoid injecting redundant `import asyncio` / `import pygame` in the pygame auto-wrap when the user already imports them
