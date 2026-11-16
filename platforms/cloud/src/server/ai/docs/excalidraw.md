# excalidraw (whiteboard drawings)

`::excalidraw{src="drawing.excalidraw"}` embeds an Excalidraw whiteboard. The
`.excalidraw` file is the drawing as JSON — create/fix it with `write_file`,
reference it with `src` (from `public/`, `book/`, or next to the page).

    ::excalidraw{src="drawing.excalidraw"}

`dock` (flag, or `dock="Label"`): readers can move the element into the dock
beside the text, to keep it in view while working through the tasks after it.
See the `dock` topic.
