---
"@hyperbook/markdown": minor
"hyperbook": minor
"@hyperbook/cloud": patch
---

New dock: a working element can be kept in view while reading the tasks around it. Add `dock` to a `pyide`, `webide`, `p5`, `openscad`, `typst`, `onlineide`, `sqlide`, `excalidraw`, `textinput`, `struktolab`, `blockflow-editor` or `jmp` (`dock="Label"` names its tab; without `dock` nothing changes) and readers get a **Dock** tab under the element. It moves the element into the dock at the right edge of the screen, on phones at the bottom, and the text makes room for it. Several docked elements share the dock as tabs, each with × to send it back. A rail on the dock's edge slides it in and out, dragging the rail resizes it, and where an element was, a line shows it in the dock when clicked, ↩ brings it back. Elements keep their state while docked: they are never re-created, only placed on screen differently. What is docked is remembered per page.

The page's table of contents and QR code buttons sit in the header next to search instead of floating over the content, where they covered text on phones. On phones the header icons move closer together and a long book title ends with "…".

On wide screens ☰ shows in the header as on phones and folds the menu away to the left and back; the menu starts out shown, and a folded menu stays folded on the next page. Below 1280px the window's scrollbar uses the book's colours instead of the browser's light default.

`struktolab` in edit mode has a **Reset** button under the editor, as the IDEs have: after asking, it throws the student's changes away and loads the structogram the page started with (its code block, else its `src` file).
