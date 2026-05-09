---
name: Pyide
permaid: pyide
lang: de
---

Das `pyide`-Element repräsentiert eine Python-Integrated-Development-Environment (IDE)-Komponente.
Es wird verwendet, um eine Python-Coding-Umgebung in die Hyperbook-Website einzubetten.
Dieses Element ermöglicht es Benutzern, Python-Code direkt im Browser zu schreiben, zu bearbeiten und auszuführen.

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

Sie können auch jedes Paket verwenden, das hier aufgeführt ist: https://pyodide.org/en/stable/usage/packages-in-pyodide.html

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

## Testfälle hinzufügen

Sie können Testfälle zu den Code-Snippets hinzufügen, indem Sie ein `test`-Tag zum Codeblock hinzufügen. Der Kommentar `#SCRIPT#` wird durch den geschriebenen Code ersetzt. Er kann an jeder Stelle des Codeblocks platziert werden.

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

Wenn Ihr Code `input()` aufruft, zeigt der Browser einen Prompt-Dialog für die Eingabe an.

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

## Ausführung stoppen

:::alert{warn}
Nutzen Sie den **Stoppen**-Button im Editor, um eine Unterbrechung anzufordern.
Das Stoppen einer Endlosschleife oder eines lang andauernden Prozesses ist jedoch nur zuverlässig, wenn diese beiden Header auf Ihrem Server gesetzt sind:
```
'Cross-Origin-Embedder-Policy': 'require-corp'
'Cross-Origin-Opener-Policy': 'same-origin'
```
:::

## Pygame

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
            elif event.type == pygame.K_ESCAPE or event.type == pygame.QUIT:
                return
        screen.fill((r, g, b))
        pygame.display.flip()
        await asyncio.sleep(1 / fps)

asyncio.run(run_game())
```

:::
