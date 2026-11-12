---
"@hyperbook/cloud": minor
---

The cloud editor's file tree names files in place: New file, New folder and Rename turn a row into a text field in the right folder, so only a name is typed, never a whole path. A name without an extension in book/ or glossary/ becomes a page, and a new folder's index.md is named after the folder. The tree knows where you are: the folder last clicked, or the open file's folder, is where new files and uploads go. Several files can be selected with Ctrl/Cmd- and Shift-click, then moved, copied, cut or deleted together, and the tree works from the keyboard (arrows, Home/End, F2, Delete, Ctrl/Cmd+C/X/V).

Pictures and other files dropped or pasted into a page (a screenshot, say) are uploaded next to it and linked; files dragged from the tree are linked too. Paths complete in HTML `src`, `href` and `poster` attributes as well.

Unsaved text is kept as a draft in the browser and comes back after a closed tab or a crash. The editor saves by itself after a pause in typing and when the browser tab is left ("Save automatically" in the editor settings, on by default). The History pane shows one person's saves in a row as one entry with their combined changes, which unfolds into the single saves.
