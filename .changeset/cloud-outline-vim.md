---
"@hyperbook/cloud": minor
---

The cloud editor has an activity bar down its left edge, as in VS Code. Files, Search, Outline, Comments, History and the AI assistant each open in the sidebar, one at a time, and choosing the shown one again folds the sidebar down to the bar; the editor settings and the light/dark toggle sit at its foot. The header keeps the book's actions and the preview toggle. Selecting a comment in the text, or Ctrl/Cmd+Alt+A, switches the sidebar to that view.

Outline lists the open file's headings (Markdown pages and snippets, and Typst documents), indented by level, and leaves out headings in the frontmatter, code blocks and Typst comments. The heading the cursor is under is marked as you move or type, and choosing one moves the cursor there.

The editor settings have Vim key bindings, with normal, insert and visual mode and the mode shown in a status line. `:w` saves the file. The choice is remembered in the browser and applies to open files right away. Closing the settings menu no longer takes the focus from an editor you are typing in.

PDFs (the Typst preview and opened PDF files) can be zoomed with −/+ buttons or Ctrl and the mouse wheel, from 25% to 400%, keeping the part in view. "Fit to width" returns to pages as wide as the pane, the default.
