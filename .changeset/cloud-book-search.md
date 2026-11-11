---
"@hyperbook/cloud": minor
---

The cloud editor searches the whole book. The sidebar has a Search view next to Files (Ctrl/Cmd+Shift+F, starting from the selected text) that searches every text file, including unsaved changes in open tabs, with match case, whole word and regular expression options. Results are grouped by file with their line, and choosing one opens the file with the match selected. Editors can replace every match: files open in a tab change in their editor, unsaved and undoable in one step, and the other files are saved together as one change in the history. The search runs in the browser, so a regular expression never runs on the server.
