---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": patch
"hyperbook-studio": minor
---

Keep the Markdown npm package and the VS Code extension small by leaving out large element runtimes.

The Markdown package no longer includes the Pyodide, GeoGebra, Typst, Blockflow and Excalidraw runtimes; it keeps their integration scripts and styles. With `cdn: true`, Blockflow now loads from `blockflow.openpatch.org` and Excalidraw from its own packages on UNPKG, so every default CDN keeps working without these files. The OpenSCAD, Online IDE and SQL IDE runtimes stay in the package because their default CDN is this package on UNPKG.

The VS Code extension no longer includes any of the eight large runtimes. Its preview loads a missing runtime from the element's default CDN, unless the book sets its own CDN URL.

`@hyperbook/types` exports `elementRuntimeFiles`, the files that show an element's runtime is available locally.
