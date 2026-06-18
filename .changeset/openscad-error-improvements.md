---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**openscad**: Fix unclear error messages — empty files no longer show `[object Object]`, and line numbers in parser errors are now correctly adjusted to match the user's code (accounting for the preview mode prepend and OpenSCAD's parser-offset reporting).
