---
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Rework the turtle of the pyide element: `import turtle` is now Python's own turtle module (from Python 3.14), drawing on the canvas of the page. Turtle programs behave as they do with Python installed on a computer.

This fixes several bugs of the previous implementation:

- Lines drawn after a large `dot()` (for example with `goto()` and `forward()`) showed up while the turtle moved and then disappeared behind the dot.
- `clear()` did not work reliably: depending on the animation, it removed lines drawn after it, or text and dots drawn before it came back.
- Functions registered with `onkey()`, `onkeypress()`, `onscreenclick()` and `ontimer()` were never called. Keys can now also be given with their Python names (`"Up"`, `"space"`), and errors inside these functions are shown in the output.
- `circle(radius, extent=...)` and other keyword arguments were ignored, and `pos() == (0, 0)` or `abs(pos())` did not work.
- Lines with a pen size of 1 were drawn blurry.

New: `undo()`, `clone()`, `teleport()`, `onclick()`, `ondrag()` and `onrelease()` on turtles, `begin_poly()`/`get_poly()`, `setworldcoordinates()`, image shapes, Tk colour names such as `"SpringGreen2"`, and the `fill()` and `no_animation()` context managers. In browsers that can pause Python (for example Chrome and Edge), a program now runs in step with its drawing, so `print()` and `input()` happen at the right moment. The **Stop** button stops the drawing and the event functions, and a turtle program stops even when the page cannot interrupt Python.

Changed to match Python: `onclick()` reacts to clicks on the turtle (use `onscreenclick()` for clicks on the canvas), fills follow the even-odd rule, an unknown colour raises an error, and pen changes take a short animation step.
