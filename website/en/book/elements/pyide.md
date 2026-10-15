---
name: Pyide
permaid: pyide
---

# PyIDE

PyIDE loads Pyodide from its versioned jsDelivr CDN by default. The full runtime distribution and its bundled packages are very large, so Hyperbook keeps them out of the exported book. Readers need an internet connection; their browsers download the runtime and requested packages and can cache these files for later visits.

To include Pyodide locally for self-hosted or offline books, set `elements.pyide.cdn` to `false` in `hyperbook.json`:

```json
{
  "name": "My offline Hyperbook",
  "elements": {
    "pyide": { "cdn": false }
  }
}
```

The CLI then downloads and caches the full distribution the first time a build uses PyIDE. To prepare an offline build, run `npx hyperbook assets fetch` while online, then `npx hyperbook build --offline`. In VS Code, also run **Hyperbook: Download Element Runtimes...** and select PyIDE. Bundled packages then work without a CDN connection. Packages installed from PyPI through the `packages` attribute still need a network connection.

See [CDN configuration](/configuration/book#local-assets-and-cdns) for custom asset servers and [hosting and caching](/hosting/caching) for browser and build caches.

The `pyide` element represents a Python Integrated Development Environment (IDE) component.
It is used to embed a Python coding environment within the hyperbook website.
This element allows users to write, edit, and execute Python code directly in the browser.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `packages` | Comma-separated list of PyPI packages to install with `micropip` before running the code | - |
| `canvas` | Enable the canvas view for libraries such as `pygame` or `turtle` | `false` |

````md
:::pyide
```python
a = 5 + 2
print(a)
```
:::
````

:::pyide


```python
a = 5 + 2
print(a)
```

:::

You can also use any package listed here: https://pyodide.org/en/stable/usage/packages-in-pyodide.html

If you need packages from PyPI, use the `packages` attribute with a comma-separated list. Hyperbook loads `micropip` and installs these packages before executing your script.

````md
:::pyide{packages="snowballstemmer"}

```python
import snowballstemmer
stemmer = snowballstemmer.stemmer("english")
print(stemmer.stemWords(["running", "runner", "runs"]))
```

:::
````

````md
:::pyide


```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::
````

:::pyide


```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::

## Add test cases

You can add test cases to the code snippets by adding a `test` tag to the code block. The `#SCRIPT#` comment will be replaced by the written code. It can be placed in any part of the code block.

````md
:::pyide

```python test
#SCRIPT#
r = check_palindrom("uhu")
if r:
print("Pass")
else:
print("Fail")
```

```python test
#SCRIPT#
r = check_palindrom("test")
if not r:
    print("Pass")
else:
    print("Fail")
```

```python
def check_palindrom(s):
    return True
```

:::

````

:::pyide

```python test
#SCRIPT#
r = check_palindrom("uhu")
if r:
    print("Pass")
else:
    print("Fail")
```

```python test
#SCRIPT#
r = check_palindrom("test")
if not r:
    print("Pass")
else:
    print("Fail")
```

```python
def check_palindrom(s):
    return True
```

:::

When your code calls `input()`, the browser shows a prompt dialog for the value.

````md
:::pyide

```python
a = input("Enter a value: ")
print(a)
```

:::
````

:::pyide


```python
a = input("Enter a value: ")
print(a)
```

:::

## Stopping the execution

:::alert{info}
Use the **Stop** button in the editor to end a program. This also works for programs that wait, for example game loops, `input()` and turtle drawings.
A program that calculates without ever waiting, such as `while True: pass`, keeps the browser so busy that the page no longer reacts. Then only closing or reloading the page helps.
:::

## Libraries with SDL

### PyGame

Top-level PyGame loops are wrapped automatically for browser execution, so you can write the loop directly without `asyncio.run(...)`.

The drawing area takes its size from `pygame.display.set_mode`, so the canvas is as large as the surface your script asks for.

````hyperbook
:::pyide{canvas}

```python
import pygame

pygame.init()
screen = pygame.display.set_mode((400, 300))
clock = pygame.time.Clock()
r = 0
g = 0
b = 0
running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r:
                r = (r + 50) % 256
            elif event.key == pygame.K_g:
                g = (g + 50) % 256
            elif event.key == pygame.K_b:
                b = (b + 50) % 256
            elif event.key == pygame.K_ESCAPE:
                running = False
        elif event.type == pygame.QUIT:
            running = False
    screen.fill((r, g, b))
    pygame.display.flip()
    clock.tick(60)
```

:::
````

:::pyide{canvas}

```python
import pygame

pygame.init()
screen = pygame.display.set_mode((400, 300))
clock = pygame.time.Clock()
r = 0
g = 0
b = 0
running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r:
                r = (r + 50) % 256
            elif event.key == pygame.K_g:
                g = (g + 50) % 256
            elif event.key == pygame.K_b:
                b = (b + 50) % 256
            elif event.key == pygame.K_ESCAPE:
                running = False
        elif event.type == pygame.QUIT:
            running = False
    screen.fill((r, g, b))
    pygame.display.flip()
    clock.tick(60)
```

:::

## Pytamaro

Use `packages="pytamaro"` to render `show_graphic(...)` and `show_animation(...)` in the output panel.

````hyperbook
:::pyide{packages="pytamaro"}

```python
from pytamaro import *

block_size = 25
num_blocks = 16
line = empty_graphic()
for col in range(num_blocks):
    if col % 2 == 0:
        color = black
    else:
        color = white
    block = rectangle(block_size, block_size, color)
    line = beside(line, block)
second_line = rotate(180, line)
finish_line = above(line, second_line)
show_graphic(finish_line)
```
:::
````

:::pyide{packages="pytamaro"}

```python
from pytamaro import *

block_size = 25
num_blocks = 16
line = empty_graphic()
for col in range(num_blocks):
    if col % 2 == 0:
        color = black
    else:
        color = white
    block = rectangle(block_size, block_size, color)
    line = beside(line, block)
second_line = rotate(180, line)
finish_line = above(line, second_line)
show_graphic(finish_line)
```
:::

## Turtle

`import turtle` gives you Python's own turtle module (the one in Python 3.14), drawing on the canvas of the element. Programs behave as they do with Python installed on a computer: the turtle draws in the same order and at the same speed, and `clear()`, `undo()`, fills, stamps, text and event handlers work as described in the [Python documentation](https://docs.python.org/3/library/turtle.html).

A few things differ because the canvas is part of the page:

- The canvas is 640×480 pixels. `screensize()` and `setup()` change its size; a larger canvas gets scrollbars.
- `mainloop()`, `done()` and `exitonclick()` are not needed. Functions registered with `onkey()`, `onscreenclick()` or `ontimer()` keep working after the program has ended, until it is run again or stopped. Key presses reach the canvas after `listen()` or a click on it.
- `textinput()` and `numinput()` ask in the input field below the canvas.
- `bgpic()` and `register_shape()` load GIF, PNG or JPEG files from the file system of the element.
- `save()` is not available.
- The **Stop** button also stops the drawing and the event handlers.

The tables list the most common functions.

### Movement

| Method | Parameters | Description |
| --- | --- | --- |
| `forward`, `fd` | `distance` | Move the turtle forward by the given distance. |
| `backward`, `bk`, `back` | `distance` | Move the turtle backward by the given distance. |
| `left`, `lt` | `angle` | Turn the turtle left by the given angle in degrees. |
| `right`, `rt` | `angle` | Turn the turtle right by the given angle in degrees. |
| `goto`, `setpos`, `setposition` | `x, y` or `(x, y)` | Move the turtle to an absolute position. |
| `setx` | `x` | Set only the x coordinate. |
| `sety` | `y` | Set only the y coordinate. |
| `setheading`, `seth` | `angle` | Set the turtle heading directly. |
| `home` | none | Move back to the center and reset the heading. |
| `teleport` | `x=None, y=None` | Jump to a position without drawing a line. |
| `circle` | `radius, extent=None, steps=None` | Draw a circle, or an arc of `extent` degrees. A positive radius curves to the left. |

### Pen and drawing

| Method | Parameters | Description |
| --- | --- | --- |
| `penup`, `pu`, `up` | none | Lift the pen so movement no longer draws lines. |
| `pendown`, `pd`, `down` | none | Lower the pen so movement draws lines again. |
| `pensize`, `width` | `width=None` | Set the stroke width for new lines. |
| `colormode` | `cmode=None` | Set or return the color mode. Use `255` before passing RGB tuples with values from 0 to 255. |
| `pencolor` | `color` | Set the line color: a name such as `"red"` or `"SpringGreen2"`, `"#ff8800"`, or an RGB tuple. |
| `fillcolor` | `color` | Set the fill color used by `begin_fill` / `end_fill`. |
| `color` | `pen` or `pen, fill` | Set line and fill color together. |
| `dot` | `size=None, *color` | Draw a filled dot at the current position. |
| `begin_fill` | none | Start recording a filled shape. |
| `end_fill` | none | Finish and fill the current shape. |
| `stamp` | none | Stamp a copy of the turtle onto the canvas and return its id. |
| `write` | `arg, move=False, align="left", font=("Arial", 8, "normal")` | Draw text at the current turtle position. |
| `bgcolor` | `color` | Set the background color of the canvas. |
| `bgpic` | `picname=None` | Show an image file as background, or remove it with `"nopic"`. |

### State

| Method | Parameters | Description |
| --- | --- | --- |
| `position`, `pos` | none | Return the current turtle position as `(x, y)`. |
| `xcor` | none | Return the current x coordinate. |
| `ycor` | none | Return the current y coordinate. |
| `heading` | none | Return the current heading in degrees. |
| `towards` | `x, y` | Return the angle from the turtle to the given point. |
| `distance` | `x, y` | Return the distance from the turtle to the given point. |
| `isdown` | none | Return whether the pen is down. |
| `pen` | `pen=None, **pendict` | Return the current pen state, or change parts of it. |
| `isvisible` | none | Return whether the turtle cursor is currently visible. |
| `shape` | `name=None` | Set or return the turtle shape: `'classic'` (default), `'arrow'`, `'turtle'`, `'triangle'`, `'square'`, `'circle'` or `'blank'`. |

### Screen and reset

| Method | Parameters | Description |
| --- | --- | --- |
| `speed` | `speed=None` | Set the animation speed from 1 (slowest) to 10 (fastest); 0 draws each step without animation. |
| `tracer` | `n=None, delay=None` | `tracer(0)` turns the animation off until `update()` is called, the quickest way to draw complex pictures. |
| `update` | none | Show everything drawn since `tracer(0)`. |
| `screensize` | `canvwidth=None, canvheight=None, bg=None` | Return or change the canvas size and background color. |
| `showturtle`, `st` | none | Show the turtle cursor. |
| `hideturtle`, `ht` | none | Hide the turtle cursor. |
| `undo` | none | Undo the turtle's last action. |
| `clear` | none | Delete this turtle's drawing but keep its position and pen. |
| `reset` | none | Delete this turtle's drawing and restore its starting state. |
| `clearscreen` | none | Delete everything, remove all turtles and reset the canvas. |

### Events

| Method | Parameters | Description |
| --- | --- | --- |
| `listen` | none | Send key presses to the canvas. |
| `onkey`, `onkeyrelease` | `fun, key` | Call `fun()` when the key is released, e.g. `"Up"`, `"space"` or `"a"`. |
| `onkeypress` | `fun, key=None` | Call `fun()` when the key is pressed. |
| `onscreenclick` | `fun, btn=1` | Call `fun(x, y)` when the canvas is clicked. |
| `onclick` | `fun, btn=1` | Call `fun(x, y)` when the turtle is clicked. |
| `ondrag` | `fun, btn=1` | Call `fun(x, y)` while the turtle is dragged; `ondrag(goto)` lets you move it with the mouse. |
| `ontimer` | `fun, t=0` | Call `fun()` after `t` milliseconds. |

### Multiple turtles

Use `Turtle()` to create additional independent turtles that share the same canvas. Each turtle has its own position, heading, color, shape, and pen state and is controlled through the object it returns.

````hyperbook
:::pyide{canvas}

```python
from turtle import *
from random import randint

speed(0)
penup()
goto(-140, 140)

for step in range(15):
  write(step, align='center')
  right(90)
  for num in range(8):
    penup()
    forward(10)
    pendown()
    forward(10)
  penup()
  backward(160)
  left(90)
  forward(20)

red = Turtle()
red.color('red')
red.shape('turtle')
red.penup()
red.goto(-160, 100)
red.pendown()

blue = Turtle()
blue.color('blue')
blue.shape('turtle')
blue.penup()
blue.goto(-160, 70)
blue.pendown()

green = Turtle()
green.shape('turtle')
green.color('green')
green.penup()
green.goto(-160, 40)
green.pendown()

for turn in range(100):
  red.forward(randint(1, 5))
  blue.forward(randint(1, 5))
  green.forward(randint(1, 5))
```

:::
````

:::pyide{canvas}

```python
from turtle import *
from random import randint

speed(0)
penup()
goto(-140, 140)

for step in range(15):
  write(step, align='center')
  right(90)
  for num in range(8):
    penup()
    forward(10)
    pendown()
    forward(10)
  penup()
  backward(160)
  left(90)
  forward(20)

red = Turtle()
red.color('red')
red.shape('turtle')
red.penup()
red.goto(-160, 100)
red.pendown()

blue = Turtle()
blue.color('blue')
blue.shape('turtle')
blue.penup()
blue.goto(-160, 70)
blue.pendown()

green = Turtle()
green.shape('turtle')
green.color('green')
green.penup()
green.goto(-160, 40)
green.pendown()

for turn in range(100):
  red.forward(randint(1, 5))
  blue.forward(randint(1, 5))
  green.forward(randint(1, 5))
```

:::

````hyperbook
:::pyide{canvas}

```python
from turtle import *

speed(50)
colormode(255)
screensize(900, 700, "#0f172a")
bgcolor("#0f172a")
pensize(2)

colors = [
    (244, 114, 182),
    (56, 189, 248),
    (251, 191, 36),
    (74, 222, 128),
]

for step in range(48):
    pencolor(colors[step % len(colors)])
    circle(160 - step * 2)
    right(15)

penup()
goto(0, -20)
pencolor("#f8fafc")
write("Hyperbook", align="center", font=("Arial", 24, "bold"))
hideturtle()
```

:::
````

:::pyide{canvas}

```python
from turtle import *

speed(50)
colormode(255)
screensize(900, 700, "#0f172a")
bgcolor("#0f172a")
pensize(2)

colors = [
    (244, 114, 182),
    (56, 189, 248),
    (251, 191, 36),
    (74, 222, 128),
]

for step in range(48):
    pencolor(colors[step % len(colors)])
    circle(160 - step * 2)
    right(15)

penup()
goto(0, -20)
pencolor("#f8fafc")
write("Hyperbook", align="center", font=("Arial", 24, "bold"))
hideturtle()
```

:::
