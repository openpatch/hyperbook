---
"@hyperbook/markdown": patch
---

Fixed the OpenSCAD runtime failing to load on Hyperbook Cloud previews and published books with the error `error loading dynamically imported module: /_hyperbook/assets/<version>/openscad.js`. The element's runtime base (`data-runtime-base`/`data-asset-base`, requested with an empty file) was emitted without a trailing slash, so the client's `new URL("openscad.js", base)` dropped the `directive-openscad` segment and asked the host for a path it does not serve. A base now keeps its trailing slash, and the worker loads `…/directive-openscad/openscad.js` as on a local build.
