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

````hyperbook
:::pyide{canvas}

```python
import pygame
import asyncio

async def run_game():
    fps = 60
    pygame.init()
    screen = pygame.display.set_mode((400, 300))
    r = 0
    g = 0
    b = 0

    while True:
        for event in pygame.event.get():
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    r = (r + 50) % 256
                elif event.key == pygame.K_g:
                    g = (g + 50) % 256
                elif event.key == pygame.K_b:
                    b = (b + 50) % 256
                elif event.key == pygame.K_ESCAPE:
                    sys.exit()
            elif event.type == pygame.QUIT:
                return
        screen.fill((r, g, b))
        pygame.display.flip()
        await asyncio.sleep(1 / fps)

asyncio.run(run_game())
```

:::
````

:::pyide{canvas}

```python
import pygame
import asyncio

async def run_game():
    fps = 60
    pygame.init()
    screen = pygame.display.set_mode((400, 300))
    r = 0
    g = 0
    b = 0

    while True:
        for event in pygame.event.get():
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    r = (r + 50) % 256
                elif event.key == pygame.K_g:
                    g = (g + 50) % 256
                elif event.key == pygame.K_b:
                    b = (b + 50) % 256
                elif event.key == pygame.K_ESCAPE:
                    sys.exit()
            elif event.type == pygame.QUIT:
                return
        screen.fill((r, g, b))
        pygame.display.flip()
        await asyncio.sleep(1 / fps)

asyncio.run(run_game())
```

:::

## Pytamaro

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
