---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Add a `jmp` directive, which embeds the Java Memory Playground.

`::jmp{src="memory.jmp"}` renders a `.jmp` file — the same JSON the playground
at jmp.openpatch.org shares in a link — as a diagram of the stack and the heap
that a reader can take apart and rebuild. `height`, `step` and `language` set
the frame, and the playground's display options are overridable per embed:
`::jmp{src="memory.jmp" hide-sidebar disable-garbage-collector}` turns the same
file into a figure to look at rather than a canvas to work on.

What a reader builds is saved as they work, not only when they press **Save**,
and comes back when they return to the page. A button in the corner of the
frame throws that away and puts back the diagram the author shipped.

`.jmp` files get path completion and the directive gets highlighting and a
`:jmp` snippet in the VS Code extension.
