# pyide (Python IDE)

`:::pyide` lets readers edit and run Python in the browser. One `python` fenced
block per file. The file runs from the block without a name (it becomes
`main.py`); every other file is named with `file="…"` on the fence. The `main`
attribute says which file runs (default `main.py`).

    :::pyide{packages="numpy"}

    ```python
    print("Hello")
    ```

    :::

Attributes: `packages` (PyPI packages, comma-separated), `canvas` (flag, for
turtle/pygame), `main`, `id`, `files`, `accept` (default `.py`). External `.py`
files: `::file{path="util.py" src="…"}` or `src` on the directive.

## Compare with a solution (CSSBattle-style, turtle)

Add `canvas` and `compare` plus a solution file with `role="solution"`: readers draw
the target picture with the turtle; every **Run** that ends without an error scores
the drawing.

    :::pyide{canvas compare pass=95}

    ```python
    import turtle
    t = turtle.Turtle()
    ```

    ```python file="solution.py" role="solution"
    import turtle
    t = turtle.Turtle()
    for i in range(4):
        t.forward(100); t.left(90)
    ```

    :::

- Scoring and views as in webide: Colour 50% / Outline 30% / Area 20%; split view
  Yours/Target with draggable line, Overlay, Differences, hold-Target; target
  colours clickable to copy hex; solved when total and each part reach `pass`
  (default 98); green outline when solved. The solution is drawn out of sight.
