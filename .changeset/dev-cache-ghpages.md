---
"hyperbook": patch
"@hyperbook/fs": patch
---

`hyperbook dev` now enables the on-disk vfile cache (`HYPERBOOK_CACHE`) by default, so a restarted dev server reuses the persisted directory listings (`vdirectory.*.json`, `vfiles.json`) instead of re-walking and re-reading the whole book on the initial build. The new `vfile.isCacheFresh` check rejects persisted listings when anything in the book or `hyperbook.json` changed while the server was not running; `vfile.clean` still deletes them on every change during a session, and the watcher ignores them, so the cache files never trigger a rebuild. Setting `HYPERBOOK_CACHE` to an empty value opts out. The GitHub Pages workflow examples in the documentation now also cache the downloaded element runtimes between runs with `actions/cache` and `HYPERBOOK_ASSET_CACHE`, matching the guidance on the Caching page.
