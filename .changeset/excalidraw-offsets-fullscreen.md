---
"@hyperbook/markdown": patch
"@hyperbook/web-component-excalidraw": patch
"hyperbook": minor
"@hyperbook/cloud": patch
---

Excalidraw: strokes, text and images land where the reader clicks, and double-clicking no longer scrolls the page up. Excalidraw measured the canvas position only on scrolls, so when content above a drawing changed height (an image loading late, a collapsible opening) it mapped clicks with an outdated offset; a text box then opened above the visible area and its focus scrolled the page. The position is now measured again before each interaction and when the page changes size or scrolls. Every drawing also gets a fullscreen button in the top-right corner, editable or not.
