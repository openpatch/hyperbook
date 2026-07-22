---
"@hyperbook/markdown": minor
"hyperbook": minor
---

**pyide**: `input()` no longer freezes the page. Python is suspended on a promise via WebAssembly JSPI and the answer is read from a field in the output panel, so the canvas keeps painting and queued turtle animation keeps draining while a script waits for input. Browsers without JSPI fall back to the previous blocking dialog. The transcript now matches a terminal: the prompt, the typed answer, then a newline. `turtle.numinput()` and `turtle.textinput()` use the same field, with CPython's re-ask and `minval`/`maxval` behaviour.

**pyide**: The editor offers autocompletion for the `turtle` module — signatures and descriptions for every function it provides, for both `from turtle import *` and member access on `turtle`, a `Turtle()` or a `Screen()`. Completions only appear once a script imports turtle, and are suppressed inside comments and strings.

**turtle**: Fixed `begin_fill()`/`end_fill()` producing nothing. Fill vertices were read when the deferred render ran rather than when the move was made, so every vertex collapsed onto the turtle's final position. Fills also painted over the lines drawn during them instead of underneath.

**turtle**: Fixed accessors destroying the value they should return — `pensize()`, `pencolor()`, `fillcolor()`, `color()` and `speed()` called without arguments reset the pen to a default instead of reporting the current one.

**turtle**: Fixed state that leaked or was lost — `clear()` during a fill left the turtle permanently unable to fill again, `clear()` reset the pen width, and `speed()` carried over between runs of a program.

**turtle**: Fixed `circle()` ignoring `extent`; the signature is now `circle(radius, extent=None, steps=None)`, so arcs work and a negative radius curves to the right. Fixed `pencolor(r, g, b)` and `color(r, g, b)` producing black, `speed("slowest")` and the other named speeds selecting the fastest setting, the turtle cursor ignoring `fillcolor`, and `towards()` rejecting a coordinate pair. `shape()` now raises on an unknown shape name instead of silently ignoring it.

**turtle**: Added the missing screen and turtle API: `done`, `mainloop`, `exitonclick`, `bye`, `Screen`, `getscreen`, `tracer`, `update`, `delay`, `undo`, `setundobuffer`, `undobufferentries`, `stamp`, `clearstamp`, `clearstamps`, `distance`, `mode` (standard and logo), `degrees`, `radians`, `filling`, `shapesize`/`turtlesize`, `tilt`, `tiltangle`, `settiltangle`, `setup`, `title`, `register_shape`/`addshape`, `clearscreen`, `resetscreen`, `window_width`, `window_height`, `numinput`, `textinput`, `listen`, `onkey`, `onkeypress`, `onkeyrelease`, `onclick`, `onscreenclick` and `ontimer`.
