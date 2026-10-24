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

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `packages` | Kommaseparierte Liste von PyPI-Paketen, die vor dem Ausführen mit `micropip` installiert werden | - |
| `canvas` | Zeigt eine Zeichenfläche für Bibliotheken wie `pygame` oder `turtle` | `false` |
| `main` | Die Datei, die ausgeführt wird | `main.py` |
| `id` | Unter welcher Kennung der Code gespeichert wird. Halten Sie sie fest, damit gespeicherter Code beim Bearbeiten des Elements erhalten bleibt | aus dem Inhalt abgeleitet |
| `files` | Was Leserinnen und Leser mit Dateien tun dürfen: `create`, `upload`, `rename`, `delete`, durch Kommas getrennt, oder `open` für alles | keine |
| `accept` | Dateiendungen für Dateien, die Leserinnen und Leser anlegen oder umbenennen, durch Kommas getrennt | `.py` |

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

## Mehrere Dateien

Ein Codeblock ohne `file="…"` ist die Hauptdatei. Weitere Dateien bekommen mit `file="…"` einen Namen und erscheinen als Tabs. Die Hauptdatei kann sie wie jedes Python-Modul importieren.

Mit `readonly` wird eine Datei angezeigt, kann aber nicht verändert werden. Mit `hidden` erscheint sie nicht im Editor, liegt beim Ausführen aber trotzdem bereit.

````md
:::pyide

```python
from helpers import greet
greet("Ada")
```

```python file="helpers.py" readonly
def greet(name):
    print(f"Hallo {name}!")
```

:::
````

:::pyide

```python
from helpers import greet
greet("Ada")
```

```python file="helpers.py" readonly
def greet(name):
    print(f"Hallo {name}!")
```

:::

Dateien aus Ihrem Buch fügen Sie mit `::file` hinzu. Python-Dateien und andere Textdateien wie CSV oder JSON erscheinen als Tab; Bilder und andere Binärdateien liegen nur für das Programm bereit. `src` wird wie jede andere Datei Ihres Buchs aufgelöst.

````md
:::pyide

```python
print(open("data.csv").read())
```

::file{path="data.csv" src="/data/klasse.csv"}

:::
````

Mit `main` wählen Sie eine andere Hauptdatei als `main.py`.

## Testfälle hinzufügen

Ein Test ist eine Datei mit `role="test"`. Meist ist sie zusätzlich `hidden`, damit sie nicht im Editor erscheint. **Test** führt alle Testdateien nacheinander aus. Der Kommentar `#SCRIPT#` wird durch den Code der Hauptdatei ersetzt. Er kann an jeder Stelle des Tests stehen.

Die Ausgabe zeigt danach einen Bericht: wie viele Tests bestanden sind und für jeden Test, ob er bestanden ist, zusammen mit dem, was er ausgegeben hat. Ein Test ist nicht bestanden, wenn ein `assert` fehlschlägt (der Bericht zeigt das `assert` und seine Meldung) oder wenn er eine Zeile ausgibt, die mit `Nicht bestanden` oder `Fail` beginnt. Wirft ein Test einen anderen Fehler, wird er als Fehler markiert und der Fehler erklärt. Sonst ist er bestanden.

````md
:::pyide

```python
def check_palindrom(s):
    return True
```

```python file="test_1.py" role="test" hidden
#SCRIPT#
r = check_palindrom("uhu")
if r:
    print("Pass")
else:
    print("Fail")
```

```python file="test_2.py" role="test" hidden
#SCRIPT#
r = check_palindrom("test")
if not r:
    print("Pass")
else:
    print("Fail")
```

:::
````

:::pyide{id="e0c3c794102458243ed5c9edfe037648cf1a3e18c7e4bcbed5afd58d34ac9238"}

```python file="test_1.py" role="test" hidden
#SCRIPT#
r = check_palindrom("uhu")
if r:
    print("Pass")
else:
    print("Fail")
```

```python file="test_2.py" role="test" hidden
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

## Dateien, die Leserinnen und Leser ändern dürfen

Mit `files` bekommen Leserinnen und Leser Knöpfe für eigene Dateien: **+** legt eine Datei an, **⤒** lädt eine hoch, und jeder Tab bekommt **✎** zum Umbenennen und **×** zum Löschen. `rename` und `delete` erlauben das auch für die Dateien der Seite; die Hauptdatei sowie `readonly`-, `hidden`- und Testdateien bleiben immer, wie sie geschrieben sind. Selbst angelegte oder hochgeladene Dateien dürfen Leserinnen und Leser immer umbenennen und löschen. Ein Klick auf den Tab einer Binärdatei zeigt eine Vorschau: Bilder, Audio und Video, PDFs, Schriftarten (TTF, OTF, WOFF) und 3D-Modelle (STL, OBJ), die sich drehen und zoomen lassen.

````md
:::pyide{files="create,upload,rename,delete"}
...
:::
````

## Mit einer Lösung vergleichen

Leserinnen und Leser können versuchen, ein vorgegebenes Bild mit der Turtle möglichst genau nachzuzeichnen, wie bei [CSSBattle](https://cssbattle.dev/). Fügen Sie `canvas`, `compare` und eine Datei mit `role="solution"` hinzu: Die Lösung wird unsichtbar gezeichnet, und jedes **Ausführen**, das ohne Fehler endet, bewertet, wie viel der Zeichnung übereinstimmt. Das vorgegebene Bild liegt in gleicher Größe und an gleicher Stelle über der eigenen Ausgabe und verdeckt sie zunächst. Eine Linie teilt beide: links die eigene Zeichnung („Deins“), rechts das Ziel („Ziel“). Nach der ersten Änderung rückt die Linie in die Mitte; man zieht sie an ihrem Griff oder mit dem Schieberegler darunter. Der Bereich darunter zeigt die Übereinstimmung und die Farben des Ziels (ein Klick kopiert den Farbwert). **Überlagert** zeigt das Ziel halb durchsichtig über der ganzen Zeichnung, **Unterschiede** markiert, was nicht passt, und gedrückt gehaltenes **Ziel** zeigt das ganze Ziel. Ist die Aufgabe gelöst, wird das Bild grün umrandet.

Die Bewertung hat drei Teile. **Farbe** (die Hälfte) vergleicht jedes Pixel, auch den Hintergrund; ähnliche Farben zählen teilweise. **Umriss** (30 %) prüft, ob die Kanten der Formen dort liegen, wo sie im Ziel liegen. **Fläche** (20 %) prüft, ob sich die gezeichneten Flächen decken, gleich in welcher Farbe. Umriss und Fläche betrachten nur die Zeichnung: Eine leere Zeichenfläche bekommt dafür nichts und höchstens die Hälfte der Punkte. Was ein Pixel daneben liegt, passt trotzdem ganz. Gelöst ist die Aufgabe, wenn die Bewertung und jeder ihrer Teile `pass` erreichen; eine Form in falscher Farbe besteht also nicht allein durch ihren Umriss. Fährt man über die Bewertung, zeigt sie die drei Teile.

````md
:::pyide{canvas compare pass=95}

```python
import turtle
t = turtle.Turtle()
```

```python file="solution.py" role="solution"
import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(90)
```

:::
````

:::pyide{canvas compare pass=95 height=520}

```python
import turtle
t = turtle.Turtle()
```

```python file="solution.py" role="solution"
import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(90)
```

:::

Verglichen wird die ganze Zeichenfläche. `pass` (Standard `98`) ist die Übereinstimmung in Prozent, ab der die Aufgabe gelöst ist. Statt einer Lösung kann `::file{path="target.png" src="…" role="target"}` das Bild vorgeben.

## Umstieg von der alten Schreibweise

Ältere Bücher kennzeichnen Tests mit ```` ```python test ```` und laden Dateien mit `src="…"` direkt am Element. Führen Sie in Ihrem Buch `npx hyperbook migrate` aus, um diese Seiten umzustellen. Dabei wird auch die `id` jeder geänderten IDE festgehalten, sodass gespeicherter Code der Leserinnen und Leser erhalten bleibt. Prüfen Sie die Änderungen vor dem Veröffentlichen mit `git diff`.
