---
name: Pyide
permaid: pyide
lang: de
---

PyIDE lädt Pyodide standardmäßig vom versionierten jsDelivr-CDN. Die vollständige Laufzeitumgebung mit ihren mitgelieferten Paketen ist sehr groß und bleibt deshalb außerhalb des exportierten Hyperbooks. Leser benötigen eine Internetverbindung. Ihr Browser lädt die Laufzeitumgebung und angeforderte Pakete und kann diese Dateien für spätere Besuche zwischenspeichern.

Für selbst gehostete oder offline nutzbare Bücher kannst du Pyodide lokal einbinden. Setze dafür `elements.pyide.cdn` in `hyperbook.json` auf `false`:

```json
{
  "name": "Mein Offline-Hyperbook",
  "elements": {
    "pyide": { "cdn": false }
  }
}
```

Die CLI lädt dann beim ersten Build mit PyIDE die vollständige Distribution herunter und speichert sie im Cache. Führe für einen Offline-Build zunächst mit Internetverbindung `npx hyperbook assets fetch` und anschließend `npx hyperbook build --offline` aus. Führe in VS Code zusätzlich **Hyperbook: Download Element Runtimes...** aus und wähle PyIDE. Mitgelieferte Pakete funktionieren dann ohne CDN-Verbindung. Pakete, die über das Attribut `packages` von PyPI installiert werden, benötigen weiterhin eine Netzwerkverbindung.

Siehe [CDN-Konfiguration](/configuration/book#lokale-dateien-und-cdns) für eigene Server und [Hosting und Caching](/hosting/caching) für Browser- und Build-Caches.

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

:::alert{info}
Nutzen Sie den **Stoppen**-Button im Editor, um ein Programm zu beenden. Das funktioniert auch bei Programmen, die warten, zum Beispiel bei Spielschleifen, `input()` und Turtle-Zeichnungen.
Ein Programm, das rechnet, ohne jemals zu warten, etwa `while True: pass`, beschäftigt den Browser so sehr, dass die Seite nicht mehr reagiert. Dann hilft nur, die Seite zu schließen oder neu zu laden.
:::

## Bibliotheken mit SDL

### PyGame

Top-Level-PyGame-Schleifen werden fuer die Browser-Ausfuehrung automatisch verpackt, daher koennen Sie die Schleife direkt ohne `asyncio.run(...)` schreiben.

Die Zeichenflaeche uebernimmt ihre Groesse aus `pygame.display.set_mode`, der Canvas ist also so gross wie die Flaeche, die Ihr Skript anfordert.

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

Verwenden Sie `packages="pytamaro"`, um `show_graphic(...)` und `show_animation(...)` im Ausgabebereich darzustellen.

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

`import turtle` stellt das Turtle-Modul von Python selbst bereit (das aus Python 3.14), das auf dem Canvas des Elements zeichnet. Programme verhalten sich wie mit einem auf dem Computer installierten Python: Die Turtle zeichnet in derselben Reihenfolge und Geschwindigkeit, und `clear()`, `undo()`, Füllungen, Stempel, Text und Ereignisse funktionieren wie in der [Python-Dokumentation](https://docs.python.org/3/library/turtle.html) beschrieben.

Weil das Canvas Teil der Seite ist, gibt es ein paar Unterschiede:

- Das Canvas ist 640×480 Pixel groß. `screensize()` und `setup()` ändern seine Größe; ein größeres Canvas bekommt Scrollbalken.
- `mainloop()`, `done()` und `exitonclick()` werden nicht benötigt. Mit `onkey()`, `onscreenclick()` oder `ontimer()` angemeldete Funktionen reagieren auch nach dem Ende des Programms, bis es erneut ausgeführt oder gestoppt wird. Tastendrücke erreichen das Canvas nach `listen()` oder einem Klick darauf.
- `textinput()` und `numinput()` fragen im Eingabefeld unter dem Canvas.
- `bgpic()` und `register_shape()` laden GIF-, PNG- oder JPEG-Dateien aus dem Dateisystem des Elements.
- `save()` steht nicht zur Verfügung.
- Der **Stoppen**-Button hält auch das Zeichnen und die Ereignisse an.

Die Tabellen zeigen die gebräuchlichsten Funktionen.

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
| `home` | keine | Bewegt die Turtle zur Mitte zurück und setzt die Ausrichtung zurück. |
| `teleport` | `x=None, y=None` | Springt zu einer Position, ohne eine Linie zu zeichnen. |
| `circle` | `radius, extent=None, steps=None` | Zeichnet einen Kreis oder einen Bogen von `extent` Grad. Ein positiver Radius biegt nach links. |

### Stift und Zeichnen

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `penup`, `pu`, `up` | keine | Hebt den Stift an, sodass Bewegungen keine Linien mehr zeichnen. |
| `pendown`, `pd`, `down` | keine | Senkt den Stift, sodass Bewegungen wieder Linien zeichnen. |
| `pensize`, `width` | `width=None` | Setzt die Strichbreite für neue Linien. |
| `colormode` | `cmode=None` | Setzt oder liefert den Farbmodus. Verwenden Sie `255`, bevor Sie RGB-Tupel mit Werten von 0 bis 255 übergeben. |
| `pencolor` | `color` | Setzt die Linienfarbe: einen Namen wie `"red"` oder `"SpringGreen2"`, `"#ff8800"` oder ein RGB-Tupel. |
| `fillcolor` | `color` | Setzt die Füllfarbe für `begin_fill` / `end_fill`. |
| `color` | `pen` oder `pen, fill` | Setzt Linien- und Füllfarbe zusammen. |
| `dot` | `size=None, *color` | Zeichnet einen gefüllten Punkt an der aktuellen Position. |
| `begin_fill` | keine | Startet die Aufzeichnung einer gefüllten Form. |
| `end_fill` | keine | Beendet und füllt die aktuelle Form. |
| `stamp` | keine | Stempelt eine Kopie der Turtle auf das Canvas und gibt ihre Nummer zurück. |
| `write` | `arg, move=False, align="left", font=("Arial", 8, "normal")` | Zeichnet Text an der aktuellen Turtle-Position. |
| `bgcolor` | `color` | Setzt die Hintergrundfarbe des Canvas. |
| `bgpic` | `picname=None` | Zeigt eine Bilddatei als Hintergrund oder entfernt sie mit `"nopic"`. |

### Status

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `position`, `pos` | keine | Gibt die aktuelle Turtle-Position als `(x, y)` zurück. |
| `xcor` | keine | Gibt die aktuelle x-Koordinate zurück. |
| `ycor` | keine | Gibt die aktuelle y-Koordinate zurück. |
| `heading` | keine | Gibt die aktuelle Ausrichtung in Grad zurück. |
| `towards` | `x, y` | Gibt den Winkel von der Turtle zum angegebenen Punkt zurück. |
| `distance` | `x, y` | Gibt den Abstand der Turtle zum angegebenen Punkt zurück. |
| `isdown` | keine | Gibt zurück, ob der Stift unten ist. |
| `pen` | `pen=None, **pendict` | Gibt den aktuellen Stiftzustand zurück oder ändert Teile davon. |
| `isvisible` | keine | Gibt zurück, ob der Turtle-Cursor aktuell sichtbar ist. |
| `shape` | `name=None` | Setzt oder liefert die Form der Turtle: `'classic'` (Standard), `'arrow'`, `'turtle'`, `'triangle'`, `'square'`, `'circle'` oder `'blank'`. |

### Bildschirm und Reset

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `speed` | `speed=None` | Setzt die Animationsgeschwindigkeit von 1 (langsamste) bis 10 (schnellste); 0 zeichnet jeden Schritt ohne Animation. |
| `tracer` | `n=None, delay=None` | `tracer(0)` schaltet die Animation ab, bis `update()` aufgerufen wird – der schnellste Weg, komplexe Bilder zu zeichnen. |
| `update` | keine | Zeigt alles, was seit `tracer(0)` gezeichnet wurde. |
| `screensize` | `canvwidth=None, canvheight=None, bg=None` | Liefert oder ändert die Größe und Hintergrundfarbe des Canvas. |
| `showturtle`, `st` | keine | Zeigt den Turtle-Cursor an. |
| `hideturtle`, `ht` | keine | Blendet den Turtle-Cursor aus. |
| `undo` | keine | Macht die letzte Aktion der Turtle rückgängig. |
| `clear` | keine | Löscht die Zeichnung dieser Turtle, behält aber Position und Stift. |
| `reset` | keine | Löscht die Zeichnung dieser Turtle und stellt ihren Anfangszustand wieder her. |
| `clearscreen` | keine | Löscht alles, entfernt alle Turtles und setzt das Canvas zurück. |

### Ereignisse

| Methode | Parameter | Beschreibung |
| --- | --- | --- |
| `listen` | keine | Leitet Tastendrücke an das Canvas. |
| `onkey`, `onkeyrelease` | `fun, key` | Ruft `fun()` auf, wenn die Taste losgelassen wird, z. B. `"Up"`, `"space"` oder `"a"`. |
| `onkeypress` | `fun, key=None` | Ruft `fun()` auf, wenn die Taste gedrückt wird. |
| `onscreenclick` | `fun, btn=1` | Ruft `fun(x, y)` auf, wenn auf das Canvas geklickt wird. |
| `onclick` | `fun, btn=1` | Ruft `fun(x, y)` auf, wenn auf die Turtle geklickt wird. |
| `ondrag` | `fun, btn=1` | Ruft `fun(x, y)` auf, während die Turtle gezogen wird; mit `ondrag(goto)` lässt sie sich mit der Maus verschieben. |
| `ontimer` | `fun, t=0` | Ruft `fun()` nach `t` Millisekunden auf. |

### Mehrere Turtles

Mit `Turtle()` lassen sich weitere unabhängige Turtles erstellen, die dasselbe Canvas teilen. Jede Turtle hat ihre eigene Position, Ausrichtung, Farbe, Form und Stiftzustand und wird über das zurückgegebene Objekt gesteuert.

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
