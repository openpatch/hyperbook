---
name: Web IDE
permaid: webide
lang: de
---

# Web IDE

Die Web IDE führt eine kleine Website aus HTML-, CSS- und JavaScript-Dateien in einem isolierten Rahmen aus. Die Seite aktualisiert sich während der Eingabe. Sie ist nützlich für Lehr- und Lernzwecke sowie zum Ausprobieren von Code-Snippets.

## Verwendung

Schreiben Sie die Seite als `html`-Codeblock in einen `:::webide`-Block. Er ist die `index.html` der Website. Weitere Dateien bekommen mit `file="…"` einen Namen und erscheinen als Tabs; `index.html` bindet sie ein wie auf jedem Webserver.

````md
:::webide

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Meine Seite</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1 class="title">Meine Überschrift</h1>
    <script src="script.js"></script>
  </body>
</html>
```

```css file="style.css"
.title {
  color: palevioletred;
}
```

```js file="script.js"
document.querySelector(".title").textContent += "!";
```

:::
````

:::webide

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Meine Seite</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1 class="title">Meine Überschrift</h1>
    <script src="script.js"></script>
  </body>
</html>
```

```css file="style.css"
.title {
  color: palevioletred;
}
```

```js file="script.js"
document.querySelector(".title").textContent += "!";
```

:::

Die Titelleiste des Rahmens zeigt den `<title>` der Seite.

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `height` | Höhe der Web IDE | `calc(100dvh - 80px)` |
| `main` | Die Seite, die im Rahmen angezeigt wird | `index.html` |
| `id` | Unter welcher Kennung der Code gespeichert wird | aus dem Inhalt abgeleitet |
| `files` | Was Leserinnen und Leser mit Dateien tun dürfen: `create`, `upload`, `rename`, `delete`, durch Kommas getrennt, oder `open` für alles | keine |
| `accept` | Dateiendungen für Dateien, die Leserinnen und Leser anlegen oder umbenennen, durch Kommas getrennt | `.html,.css,.js` |

## Dateien

Mit `readonly` wird eine Datei angezeigt, kann aber nicht verändert werden. Mit `hidden` erscheint sie nicht im Editor, wird von der Seite aber trotzdem geladen. `::file{path="…" src="…"}` fügt eine Datei aus Ihrem Buch hinzu, zum Beispiel ein Bild oder eine Bibliothek:

````md
:::webide

```html
<img src="logo.png" alt="Logo" />
<script src="confetti.js"></script>
```

::file{path="logo.png" src="/logo.png"}
::file{path="confetti.js" src="/js/confetti.js" hidden}

:::
````

Bibliotheken von einem CDN funktionieren ebenfalls: Binden Sie sie mit ihrer vollständigen URL ein.

## Dateien, die Leserinnen und Leser ändern dürfen

Mit `files` bekommen Leserinnen und Leser Knöpfe für eigene Dateien: **+** legt eine Datei an, **⤒** lädt eine hoch, und jeder Tab bekommt **✎** zum Umbenennen und **×** zum Löschen. `rename` und `delete` erlauben das auch für die Dateien der Seite; die Hauptdatei sowie `readonly`-, `hidden`- und Testdateien bleiben immer, wie sie geschrieben sind. Selbst angelegte oder hochgeladene Dateien dürfen Leserinnen und Leser immer umbenennen und löschen. Ein Klick auf den Tab einer Binärdatei zeigt eine Vorschau: Bilder, Audio und Video, PDFs, Schriftarten (TTF, OTF, WOFF) und 3D-Modelle (STL, OBJ), die sich drehen und zoomen lassen.

````md
:::webide{files="create,upload,rename,delete"}
...
:::
````

## Mit einer Lösung vergleichen

Wie bei [CSSBattle](https://cssbattle.dev/) können Leserinnen und Leser versuchen, eine vorgegebene Seite möglichst genau nachzubauen. Fügen Sie `compare` und eine Seite mit `role="solution"` hinzu: Lösung und eigene Seite werden in gleicher Größe dargestellt, und die Seite wird beim Tippen bewertet. Das vorgegebene Bild liegt in gleicher Größe und an gleicher Stelle über der eigenen Ausgabe und verdeckt sie zunächst. Eine Linie teilt beide: links die eigene Zeichnung („Deins“), rechts das Ziel („Ziel“). Nach der ersten Änderung rückt die Linie in die Mitte; man zieht sie an ihrem Griff oder mit dem Schieberegler darunter. Der Bereich darunter zeigt die Übereinstimmung und die Farben des Ziels (ein Klick kopiert den Farbwert). **Überlagert** zeigt das Ziel halb durchsichtig über der ganzen Zeichnung, **Unterschiede** markiert, was nicht passt, und gedrückt gehaltenes **Ziel** zeigt das ganze Ziel. Ist die Aufgabe gelöst, wird das Bild grün umrandet.

Die Bewertung hat drei Teile. **Farbe** (die Hälfte) vergleicht jedes Pixel, auch den Hintergrund; ähnliche Farben zählen teilweise. **Umriss** (30 %) prüft, ob die Kanten der Formen dort liegen, wo sie im Ziel liegen. **Fläche** (20 %) prüft, ob sich die gezeichneten Flächen decken, gleich in welcher Farbe. Umriss und Fläche betrachten nur die Zeichnung: Eine leere Zeichenfläche bekommt dafür nichts und höchstens die Hälfte der Punkte. Was ein Pixel daneben liegt, passt trotzdem ganz. Gelöst ist die Aufgabe, wenn die Bewertung und jeder ihrer Teile `pass` erreichen; eine Form in falscher Farbe besteht also nicht allein durch ihren Umriss. Fährt man über die Bewertung, zeigt sie die drei Teile.

````md
:::webide{compare pass=95}

```html
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body><div class="box"></div></body>
</html>
```

```css file="style.css"
body { margin: 0; background: #5d3a3a; }
.box { width: 150px; height: 150px; background: #b5e0ba; }
```

```html file="solution.html" role="solution"
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body style="margin: 0; background: #5d3a3a">
    <div style="width: 200px; height: 200px; margin: 50px 100px; background: #b5e0ba; border-radius: 50%"></div>
  </body>
</html>
```

:::
````

:::webide{compare pass=95 height=480}

```html
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body><div class="box"></div></body>
</html>
```

```css file="style.css"
body { margin: 0; background: #5d3a3a; }
.box { width: 150px; height: 150px; background: #b5e0ba; }
```

```html file="solution.html" role="solution"
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body style="margin: 0; background: #5d3a3a">
    <div style="width: 200px; height: 200px; margin: 50px 100px; background: #b5e0ba; border-radius: 50%"></div>
  </body>
</html>
```

:::

Die Lösungsseite wird mit den übrigen Dateien der Leserinnen und Leser angezeigt und kann daher dieselbe `style.css` einbinden. Eine Seite hat keine eigene Größe, daher werden beide Seiten in derselben Größe dargestellt: 400×300 Pixel, oder was `compare="600x400"` angibt. Die eigene Seite ist in einem Rahmen dieser Größe zu sehen, und nur was hineinpasst, zählt. `pass` (Standard `98`) ist die Übereinstimmung in Prozent, ab der die Aufgabe gelöst ist. Skripte laufen, bevor das Bild aufgenommen wird.

Zum Vergleichen wird eine Seite über ein SVG-Bild gezeichnet, das selbst nichts nachladen darf: Stylesheets, Bilder und Zeichenflächen werden eingebettet, CSS-Hintergrundbilder (`url(…)`) und Schriften von anderen Servern fehlen aber. Das betrifft die Lösung genauso, der Vergleich bleibt also fair; verwenden Sie für solche Aufgaben trotzdem Farben, Formen und die Schriften des Browsers. Die Lösung ist Teil der Seite; wer in den Quelltext der Seite schaut, findet sie.

## Umstieg von der alten Schreibweise

Früher nahm die Web IDE je einen unbenannten `html`-, `css`- und `js`-Block und setzte sie in eine feste Vorlage ein, die ein `html template`-Block ersetzen konnte. Führen Sie in Ihrem Buch `npx hyperbook migrate` aus, um solche Seiten in eine `index.html` mit eingebundener `style.css` und `script.js` umzuwandeln.
