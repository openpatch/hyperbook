---
"hyperbook": patch
---

`hyperbook dev` now enables the on-disk vfile cache (`HYPERBOOK_CACHE`) by default, so a restarted dev server reuses the persisted directory listings (`vdirectory.*.json`, `vfiles.json`) instead of re-walking and re-reading the whole book on the initial build. The files are deleted on every change and ignored by the watcher, so they never trigger a rebuild. The GitHub Pages workflow examples in the documentation now also cache the downloaded element runtimes between runs with `actions/cache` and `HYPERBOOK_ASSET_CACHE`, matching the guidance on the Caching page.
