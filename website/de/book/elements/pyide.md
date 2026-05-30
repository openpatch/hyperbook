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

Wenn Sie Pakete aus PyPI benötigen, verwenden Sie das Attribut `packages` mit einer kommaseparierten Liste. Hyperbook lädt `micropip` und installiert diese Pakete vor der Ausführung Ihres Skripts.

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

## Bibliotheken mit SDL

### PyGame

Top-Level-PyGame-Schleifen werden fuer die Browser-Ausfuehrung automatisch verpackt, daher koennen Sie die Schleife direkt ohne `asyncio.run(...)` schreiben.

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

Verwenden Sie `canvas` zusammen mit `packages="pytamaro"`, um `show_graphic(...)` direkt auf dem Canvas statt im Ausgabebereich darzustellen.

````hyperbook
:::pyide{canvas packages="pytamaro"}

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

:::pyide{canvas packages="pytamaro"}

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

Die Browser-Turtle-API steht ueber `from turtle import *` zur Verfuegung.

### Bewegung

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `forward`, `fd` | `distance` | Bewegt die Turtle um die angegebene Strecke nach vorn. |
| `backward`, `bk`, `back` | `distance` | Bewegt die Turtle um die angegebene Strecke nach hinten. |
| `left`, `lt` | `angle` | Dreht die Turtle um den angegebenen Winkel nach links. |
| `right`, `rt` | `angle` | Dreht die Turtle um den angegebenen Winkel nach rechts. |
| `goto`, `setpos`, `setposition` | `x, y` oder `(x, y)` | Bewegt die Turtle zu einer absoluten Position. |
| `setx` | `x` | Setzt nur die x-Koordinate. |
| `sety` | `y` | Setzt nur die y-Koordinate. |
| `setheading`, `seth` | `angle` | Setzt die Ausrichtung der Turtle direkt. |
| `home` | keine | Bewegt die Turtle zur Mitte zurueck und setzt die Ausrichtung zurueck. |
| `circle` | `radius, steps=120` | Zeichnet einen angenaeherten Kreis. |

### Stift und Zeichnen

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `penup`, `pu`, `up` | keine | Hebt den Stift an, sodass Bewegungen keine Linien mehr zeichnen. |
| `pendown`, `pd`, `down` | keine | Senkt den Stift, sodass Bewegungen wieder Linien zeichnen. |
| `pensize`, `width` | `size` | Setzt die Strichbreite fuer neue Linien. |
| `colormode` | `mode=1.0` | Setzt oder liefert den aktuellen Farbmodus. Verwenden Sie `255`, bevor Sie RGB-Tupel mit Werten von 0 bis 255 uebergeben. |
| `pencolor` | `color` | Setzt die Linienfarbe. |
| `fillcolor` | `color` | Setzt die Fuellfarbe fuer `begin_fill` / `end_fill`. |
| `color` | `stroke` oder `stroke, fill` | Setzt Linien- und Fuellfarbe zusammen. |
| `dot` | `size=5, color=None` | Zeichnet einen gefuellten Punkt an der aktuellen Position. |
| `begin_fill` | keine | Startet die Aufzeichnung einer gefuellten Form. |
| `end_fill` | keine | Beendet und fuellt die aktuelle Form. |
| `write` | `text, move=False, align=\"left\", font=None` | Zeichnet Text an der aktuellen Turtle-Position. |
| `bgcolor` | `color` | Setzt die Hintergrundfarbe des Turtle-Canvas. |
| `bgpic` | `filename=\"\"` | Laedt ein Hintergrundbild aus dem Pyodide-Dateisystem oder entfernt es mit einem leeren String. |

### Status

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `position`, `pos` | keine | Gibt die aktuelle Turtle-Position als `(x, y)` zurueck. |
| `xcor` | keine | Gibt die aktuelle x-Koordinate zurueck. |
| `ycor` | keine | Gibt die aktuelle y-Koordinate zurueck. |
| `heading` | keine | Gibt die aktuelle Ausrichtung in Grad zurueck. |
| `towards` | `x, y` | Gibt den Winkel von der Turtle zum angegebenen Punkt zurueck. |
| `pen` | `options=None` | Gibt den aktuellen Stiftzustand zurueck oder aktualisiert Teile davon ueber ein Dictionary-aehnliches Objekt. |
| `isvisible` | keine | Gibt zurueck, ob der Turtle-Cursor aktuell sichtbar ist. |
| `shape` | `name=None` | Setzt oder gibt die Form der Turtle zurueck. Verfuegbare Formen: `'classic'` (Standard), `'arrow'`, `'turtle'`, `'triangle'`, `'square'`, `'circle'`. |

### Bildschirm und Reset

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `speed` | `value=0` | Setzt die Animationsgeschwindigkeit der Turtle. Hoehere Werte zeichnen schneller. |
| `screensize` | `canvwidth=None, canvheight=None, bg=None` | Gibt die aktuelle Canvas-Groesse zurueck oder aendert Groesse und optionale Hintergrundfarbe. Wenn das Canvas groesser als der sichtbare Bereich ist, erscheinen Scrollbalken. Standardgroesse ist 640×480. |
| `showturtle`, `st` | keine | Zeigt den Turtle-Cursor an. |
| `hideturtle`, `ht` | keine | Blendet den Turtle-Cursor aus. |
| `clear` | keine | Loescht die Zeichnung, behaelt aber den aktuellen Turtle-Zustand bei. |
| `reset` | keine | Setzt den Turtle-Zustand zurueck und loescht die Zeichnung. |

### Mehrere Turtles

Mit `Turtle()` lassen sich weitere unabhaengige Turtles erstellen, die dasselbe Canvas teilen. Jede Turtle hat ihre eigene Position, Ausrichtung, Farbe, Form und Stiftzustand und wird ueber das zurueckgegebene Objekt gesteuert.

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
