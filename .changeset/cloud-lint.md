---
"@hyperbook/cloud": minor
---

Hyperbook Cloud uses `hyperbook lint`. The editor marks what a build would complain about on the open page as you type: broken links and images, missing `src` files, elements written wrong. These come from the same checks as `hyperbook lint`, next to the editor's own instant checks, while the preview is open or closed. "Check all pages" now lists every error, warning and note with its file and line, each opening the editor at that line, including unknown options in `hyperbook.json` and permaids claimed twice. The check runs on a copy of its own, so the preview no longer waits behind a slow page while it runs.
