---
"@hyperbook/markdown": minor
"hyperbook": minor
---

The `archive` directive gained an `include` attribute for pulling extra files or folders into a zipped archive at build time, without symbolic links: `:::archive[Projekt: Spielwerkstatt]{name="spielwerkstatt" include="/book/projekte/spielwerkstatt/assets=assets"}` zips `archives/spielwerkstatt/` plus the folder `book/projekte/spielwerkstatt/assets` as `assets` inside the zip. Sources are book-root-relative paths (files or folders, folders recursively including dotfiles), destinations are relative paths inside the zip; both may be given as a comma-separated list. Missing sources, sources outside the book root and destinations that collide with existing archive entries fail the build with an error naming the declaring page. Hyperbook Cloud strips symlink entries from zip uploads, so `include=` is the portable way to share a folder between the book and an archive.
