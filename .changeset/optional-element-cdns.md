---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": patch
---

Add per-element `cdn` settings under `elements` in hyperbook.json for Blockflow, Online IDE, SQL IDE, Excalidraw, OpenSCAD, GeoGebra, PyIDE and Typst. Set `cdn: true` to use the default versioned CDN or provide an HTTP(S) base URL for custom hosting. Local assets remain the default; builds, incremental previews and project asset prefetching skip local runtime bundles for CDN-enabled elements while retaining their small integration files.
