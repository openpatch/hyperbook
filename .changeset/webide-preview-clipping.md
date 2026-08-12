---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix the bottom of the webide preview being clipped

The preview container holds a title bar and the iframe, but the iframe was
sized with `height: 100%` of that container. It therefore overhung the
container by the height of the title bar, and `overflow: hidden` cut that part
off. Since the iframe itself had no overflow at that size, the hidden area was
not reachable by scrolling either — the last ~40px of every preview were simply
gone. The container is now a flex column and the iframe takes the remaining
space, the same way the editor side already worked.
