# dock (keep an element in view)

`dock` is an attribute, not a directive. On `pyide`, `webide`, `p5`,
`openscad`, `typst`, `onlineide`, `sqlide`, `excalidraw` and `textinput` it
gives readers a **Dock** tab under the element: one click moves the element
into the dock at the right edge of the screen (on phones: at the bottom), so
it stays in view while they scroll through the tasks around it. Several docked
elements share the dock as tabs; the element keeps its state while docked.

Use it when a page has one working element and several tasks after it, with
text, images or diagrams the reader needs while working:

    :::pyide{dock}

    ```python
    numbers = [3, 1, 4, 1, 5]
    ```

    :::

    ## Task 1
    …

    ::textinput{dock="Notes"}

- `dock` alone: the tab is named after the element's kind (Python, Notes, …).
- `dock="Label"`: the tab shows `Label`. Use it when a page has two elements
  of the same kind.
- Without `dock` (the default) the element cannot be docked. `dock=false`
  says so explicitly.

Other elements ignore `dock`; do not add it to them. Do not add it to every
element on a page either: it is for the one or two a reader works in while
reading.
