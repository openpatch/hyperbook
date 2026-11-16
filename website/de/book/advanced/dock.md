---
name: Dock
permaid: dock
---

# Dock

Oft hat eine Seite ein Arbeitselement – ein IDE, eine Zeichnung, ein Textfeld – und viele Aufgaben mit Bildern und Diagrammen drumherum. Beim Scrollen zwischen beiden verschwindet das Element aus dem Blick.

Mit `dock` an einem Element bekommen Lesende einen Tab **Dock** darunter. Das Element wandert ins Dock am rechten Bildschirmrand (auf dem Handy: am unteren Rand) und bleibt dort, während sie durch die Aufgaben scrollen. Der Text macht Platz für das Dock.

- Mehrere angedockte Elemente teilen sich das Dock als Tabs.
- Die Leiste am Rand des Docks klappt es ein und aus; an ihr ziehen ändert die Größe.
- Wo das Element war, steht eine Zeile: Ein Klick zeigt es im Dock, ↩ holt es zurück.
- Das Element behält seinen Zustand: Es wird nie neu erzeugt, nur auf dem Bildschirm verschoben.

## Verwendung

```md
:::pyide{dock}
:::

::textinput{dock="Meine Notizen"}
```

| Wert | Wirkung |
| --- | --- |
| kein `dock` | Das Element lässt sich nicht andocken (Standard). |
| `dock` | Es lässt sich andocken; der Tab heißt nach der Art des Elements (Python, Notizen, …). |
| `dock="Name"` | Es lässt sich andocken, und der Tab zeigt `Name`. |
| `dock=false` | Es lässt sich nicht andocken. |

`dock` funktioniert bei `pyide`, `webide`, `p5`, `openscad`, `typst`, `onlineide`, `sqlide`, `excalidraw`, `textinput`, `struktolab`, `blockflow-editor` und `jmp`.

## Beispiel: ein Arbeitsblatt

Probiere **Dock** bei mehreren Elementen unten aus und scrolle dann durch die Aufgaben.

:::pyide{dock height=400}

```python
zahlen = [3, 1, 4, 1, 5, 9, 2, 6]
print(zahlen)
```

:::

::textinput{dock placeholder="Notizen zu den Aufgaben …"}

### Aufgabe 1: Summe

Schreibe ein Programm, das alle Zahlen der Liste `zahlen` addiert. Verwende eine Schleife, nicht das eingebaute `sum`. Notiere deine Idee zuerst im Textfeld.

![](/clouds.jpg)

### Aufgabe 2: Den Ablauf zeichnen

Skizziere den Ablauf deines Programms aus Aufgabe 1 als Diagramm.

::excalidraw{dock="Ablauf" edit=true aspectRatio="4/3"}

### Aufgabe 3: Maximum

Finde die größte Zahl, ohne `max` zu verwenden. Mit welchem Wert startest du?

| Durchlauf | Element | Größtes bisher |
| --- | --- | --- |
| 1 | 3 | 3 |
| 2 | 1 | 3 |
| 3 | 4 | 4 |
| 4 | 1 | 4 |
| 5 | 5 | 5 |

### Aufgabe 4: Dasselbe in Java

:::onlineide{dock height=400}

```java Main.java
println("Hallo Welt");
```

:::

Gib alle geraden Zahlen von 1 bis 100 aus.

### Aufgabe 5: Flüsse abfragen

:::sqlide{dock}

```mysql Statements.sql
SELECT * FROM fluss;
```

::file{path="setup.sql" src="/setup.sql"}

:::

Welcher Fluss ist der längste? Schreibe eine Abfrage, die das mit einer Zeile beantwortet.

### Aufgabe 6: Eine Skizze

:::p5{dock mode="editor" height=400}

```js
function setup() {
  createCanvas(200, 200);
}

function draw() {
  background(220);
  circle(mouseX, mouseY, 20);
}
```

:::

Ändere die Skizze so, dass der Kreis eine Spur hinterlässt.

### Aufgabe 7: Eine Webseite

:::webide{dock height=400}

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Meine Zahlen</h1>
  </body>
</html>
```

:::

Zeige die Liste der Zahlen aus Aufgabe 1 als HTML-Liste.

### Aufgabe 8: Ein Struktogramm

Zeichne die Schleife aus Aufgabe 1 als Struktogramm.

:::struktolab{mode="edit" dock}

```
summe = 0
wiederhole für i = 0 bis 7:
    summe = summe + zahlen[i]
ausgabe(summe)
```

:::

### Aufgabe 9: Speicher

Zeichne, was nach `int[] a = {1, 2}; int[] b = a;` im Speicher steht.

::jmp{src="../elements/memory.jmp" dock}

### Aufgabe 10: Blöcke

Lass die Katze zum rechten Rand laufen und „Fertig“ sagen.

::::blockflow-editor{title="Blöcke" dock}

:::step{title="Laufen"}
Benutze eine Schleife, um die Katze zu bewegen.
:::

::::

### Bonus

Schreibe eine Funktion `median(liste)`, die den Median zurückgibt. Teste sie mit Listen gerader und ungerader Länge.

![](/clouds.jpg)
