---
"@hyperbook/markdown": patch
---

Add a fullscreen button to the `jmp` element.

A memory diagram is worked on rather than only looked at, and inside a book page there is rarely
enough room to drag a node anywhere useful. The button sits next to reset in the figure's bottom
right corner and puts the whole figure — the playground and both of those buttons — on the screen
on its own.

The whole figure goes fullscreen rather than the web component, so the reset and fullscreen
buttons, which live beside the component rather than inside it, are not left behind on the page.
The button reads its state back from the browser on `fullscreenchange`, so it still says the right
thing after a reader leaves fullscreen with Escape or F11.
