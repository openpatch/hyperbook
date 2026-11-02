---
"@hyperbook/markdown": patch
"@hyperbook/web-component-excalidraw": patch
"hyperbook": minor
---

Excalidraw: an editable drawing keeps its view settings after a reload, and two drawings with the same `src` no longer share one saved copy. The directive passes its `id` (from the attribute or generated) to the element; before, every drawing was saved under its `src`. The app state is saved as `appState`, which is the field the element reads; before, it was saved as `state` and dropped on load. Drawings saved by older versions still load. Editable drawings with a `src` get **Reset to template** in the Excalidraw menu, which discards the reader's changes and loads the template again. The element also gets the book's language, so Excalidraw no longer shows English in German books.
