---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"@hyperbook/cloud": minor
---

Hyperbook Cloud no longer copies the element runtimes (Pyodide, Excalidraw, GeoGebra, ... — about 500 MB together) into every build of every book. It extracts them once per Hyperbook version and serves them to every book at `/_hyperbook/assets/<version>/`, with a year of immutable caching. Books whose `elements.*.cdn` is unset or `true` link there instead of a public CDN; `false` (a local copy) and custom URLs keep their meaning. Under Settings → Element runtimes, admins choose per element whether books load its runtime from the instance or from the element's public CDN. Hosts other than Hyperbook Cloud get the same mechanism through `HYPERBOOK_SHARED_ASSETS_BASE` and `HYPERBOOK_CDN_ELEMENTS`; builds without them are unchanged. The build sandbox also keeps an asset cache between builds now, so books that ask for local runtimes are not unpacked again for every build.
