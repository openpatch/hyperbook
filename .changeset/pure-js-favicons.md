---
"hyperbook": patch
---

Favicon generation from the book's logo no longer needs `sharp`, a native addon the build sandbox of Hyperbook Cloud forbids — so books there never got favicons from their logo. Raster logos are now scaled by Jimp (pure JavaScript), SVG logos are rasterized by resvg compiled to WebAssembly (shipped beside the bundled CLI, no native addon), and exactly what pages reference is written: `favicon.ico` in the book's root, and `apple-touch-icon.png` plus `manifest.webmanifest` with its icons in the assets' favicons folder. Books on Hyperbook Cloud get their favicons from their logo now; a book can still ship its own `favicon.ico` to keep generation from running.
