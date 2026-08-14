---
name: Java Memory Playground
permaid: jmp
---

# Java Memory Playground

The `jmp` element embeds the [Java Memory Playground](https://jmp.openpatch.org) — a diagram of the
stack and the heap that your readers can take apart and rebuild. You do **not** need to write any
HTML.

## Basic Usage

Put a `.jmp` file next to your page (or into `public/`) and point the element at it:

````markdown
::jmp{id="jmp-example" height="600px" src="memory.jmp"}
````

::jmp{id="jmp-example" height="600px" src="memory.jmp"}

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `id` | Unique identifier for the playground instance | auto-generated |
| `height` | Height of the container, for example `600px` or `100%` | `600px` |
| `src` | Path to the `.jmp` file | - |
| `step` | The step to show first, zero based | first step |
| `language` | Interface language, `en` or `de` | the book's language |

### Options

A `.jmp` file carries its own options. These attributes override them, so the same diagram can be an
editable exercise on one page and a picture to look at on another. Write the attribute on its own to
switch an option on, or `="false"` to switch it off.

| Attribute | Description |
|---|---|
| `hide-sidebar` | Hide the palette of draggable classes on the left |
| `hide-call-method` | Hide the "Call Method" entry in the sidebar |
| `hide-declare-global-variable` | Hide the "Declare Global Variable" entry in the sidebar |
| `hide-new-array` | Hide the "new Array" entry in the sidebar |
| `disable-garbage-collector` | Hide the garbage collector button |
| `create-new-on-edge-drop` | Create a new object when a reference is dropped on empty canvas |
| `inline-strings` | Draw String values inside the object that references them instead of as their own heap box. On by default |
| `hide-steps` | Hide the step bar, for a page that is about one picture |
| `hide-step-changes` | Stop marking what a step changed compared with the one before it |
| `gc-prediction` | Ask which objects are unreachable before collecting them |

For a figure the reader is only meant to look at:

````markdown
::jmp{src="memory.jmp" hide-sidebar disable-garbage-collector}
````

## Saving and resetting

Whatever a reader builds is saved in their browser and is still there when they come back — they do
not have to press **Save** for that. The button in the bottom right corner throws their version away
and puts back the diagram you shipped.

## Steps

A `.jmp` file can hold a sequence of steps rather than a single picture, which is how a diagram shows
a frame being pushed and popped, or an object becoming garbage the moment the last reference to it
goes away. A step marked as an exercise is one the reader builds themselves, and **Check** compares
what they made with your solution.

## Editor

Use the playground itself to author a diagram: open [jmp.openpatch.org](https://jmp.openpatch.org),
append `?edit` for the teacher's view, and click **Save (URL)** — the diagram is then in the address
bar and can be downloaded as a `.jmp` file.

The project also ships a VS Code extension that opens `.jmp` files as the diagram rather than as
JSON: [Java Memory Playground Studio](https://github.com/openpatch/java-memory-playground/tree/main/platforms/vscode)
