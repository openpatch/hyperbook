---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Update the Online IDE runtime to build 44 and the SQL IDE to build 5: a file marked `hidden` now stays out of the IDE's file explorer, also after cached reader edits come back, so readers cannot open, edit or delete it. It stays in the workspace, so tests against a hidden solution keep running.
