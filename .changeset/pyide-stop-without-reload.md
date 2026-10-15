---
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Stop a running pyide program without reloading the page. Stop now cancels the program where it waits — in a game loop, at `input()`, or while the turtle draws — so learners keep their place on the page, and pages no longer need the `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers for it. The button is always labelled "Stop". Only a program that ignores the stop is ended by reloading the page; the page then scrolls back to the same IDE and shows "Execution stopped." in its output.
