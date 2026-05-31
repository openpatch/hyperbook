---
name: Pyide
permaid: pyide
---

# Pyide

The `pyide` element represents a Python Integrated Development Environment (IDE) component.
It is used to embed a Python coding environment within the hyperbook website.
This element allows users to write, edit, and execute Python code directly in the browser.

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

:::alert{warn}
Use the **Stop** button in the editor to request an interrupt.
For infinite loops or long-running processes, interruption is only reliable when these two headers are set on your server:
```
'Cross-Origin-Embedder-Policy': 'require-corp'
'Cross-Origin-Opener-Policy': 'same-origin'
```
:::

## Libraries with SDL

### PyGame

Top-level PyGame loops are wrapped automatically for browser execution, so you can write the loop directly without `asyncio.run(...)`.

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

The browser turtle API is available via `from turtle import *`.

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
| `circle` | `radius, steps=120` | Draw an approximated circle. |

### Pen and drawing

| Method | Parameters | Description |
| --- | --- | --- |
| `penup`, `pu`, `up` | none | Lift the pen so movement no longer draws lines. |
| `pendown`, `pd`, `down` | none | Lower the pen so movement draws lines again. |
| `pensize`, `width` | `size` | Set the stroke width for new lines. |
| `colormode` | `mode=1.0` | Set or return the current color mode. Use `255` before passing RGB tuples with values from 0 to 255. |
| `pencolor` | `color` | Set the line color. |
| `fillcolor` | `color` | Set the fill color used by `begin_fill` / `end_fill`. |
| `color` | `stroke` or `stroke, fill` | Set stroke and fill color together. |
| `dot` | `size=5, color=None` | Draw a filled dot at the current position. |
| `begin_fill` | none | Start recording a filled shape. |
| `end_fill` | none | Finish and fill the current shape. |
| `write` | `text, move=False, align=\"left\", font=None` | Draw text at the current turtle position. |
| `bgcolor` | `color` | Set the turtle canvas background color. |
| `bgpic` | `filename=\"\"` | Load a background image from the Pyodide file system, or clear it with an empty string. |

### State

| Method | Parameters | Description |
| --- | --- | --- |
| `position`, `pos` | none | Return the current turtle position as `(x, y)`. |
| `xcor` | none | Return the current x coordinate. |
| `ycor` | none | Return the current y coordinate. |
| `heading` | none | Return the current heading in degrees. |
| `towards` | `x, y` | Return the angle from the turtle to the given point. |
| `pen` | `options=None` | Return the current pen state, or update parts of it from a dictionary-like object. |
| `isvisible` | none | Return whether the turtle cursor is currently visible. |
| `shape` | `name=None` | Set or return the turtle shape. Available shapes: `'classic'` (default), `'arrow'`, `'turtle'`, `'triangle'`, `'square'`, `'circle'`. |

### Screen and reset

| Method | Parameters | Description |
| --- | --- | --- |
| `speed` | `value=0` | Set the turtle animation speed. Higher values draw faster. |
| `screensize` | `canvwidth=None, canvheight=None, bg=None` | Return or update the turtle canvas size and optional background color. Scrollbars appear when the canvas is larger than the panel. Default size is 640×480. |
| `showturtle`, `st` | none | Show the turtle cursor. |
| `hideturtle`, `ht` | none | Hide the turtle cursor. |
| `clear` | none | Clear the drawing but keep the current turtle state. |
| `reset` | none | Reset the turtle state and clear the drawing. |

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
