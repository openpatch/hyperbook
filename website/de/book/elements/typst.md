---
name: Typst
permaid: typst
---

# Typst

Der Typst-Compiler, der Renderer, das JavaScript-Bundle und die Standardschriftarten sind lokal im exportierten Hyperbook enthalten. Die CLI lädt sie beim ersten Build mit diesem Element herunter und speichert sie im Cache. Typst-Pakete aus `@preview` und externe Ressourcen im Dokument benötigen weiterhin eine Netzwerkverbindung.

Die Typst-Direktive ermöglicht es dir, [Typst](https://typst.app/)-Dokumente direkt in deinem Hyperbook zu rendern. Typst ist ein modernes Markup-basiertes Satzsystem, das einfach zu erlernen ist und schöne Dokumente erzeugt.

## Optionen

| Option | Beschreibung | Standard |
|--------|--------------|----------|
| `id` | Eindeutiger Bezeichner für den Typst-Block | Automatisch generiert |
| `mode` | Anzeigemodus: `preview` (nur Ansicht) oder `edit` (mit Editor) | `preview` |
| `height` | Höhe des Vorschau-Containers | `auto` |
| `main` | Die Datei, die kompiliert wird | `main.typ` |
| `files` | Was Leserinnen und Leser mit Dateien tun dürfen: `create`, `upload`, `rename`, `delete`, durch Kommas getrennt, oder `open` für alles | `create,upload` |
| `accept` | Dateiendungen für Dateien, die Leserinnen und Leser anlegen oder umbenennen, durch Kommas getrennt | `.typ` |

## Wichtige Hinweise

- **Mehrere Typst-Blöcke**: Wenn mehrere Typst-Blöcke auf derselben Seite vorhanden sind, werden sie nacheinander gerendert (einer nach dem anderen), um die Dateiisolierung zu gewährleisten. Jeder Block behält sein eigenes unabhängiges Dateisystem während des Renderns bei.
- **Dateiisolierung**: Dateien, die in einem Typst-Block geladen werden (über `::file` oder benannte Codeblöcke), sind vollständig von anderen Blöcken auf derselben Seite isoliert. Das bedeutet, dass du denselben Dateinamen (z.B. `other.typ`) in verschiedenen Blöcken ohne Konflikte verwenden kannst.


## Verwendung

Um die Typst-Direktive zu verwenden, umschließe deinen Typst-Code in einem `:::typst`-Block mit einem Code-Block, der die Sprache `typ` oder `typst` verwendet.

### Vorschau-Modus

Im Vorschau-Modus wird nur die gerenderte Ausgabe mit einem Download-Button zum Exportieren als PDF angezeigt.

````md
:::typst{mode="preview"}

```typ
= Hallo Welt!

Dies ist ein einfaches Typst-Dokument.

- Erster Eintrag
- Zweiter Eintrag
- Dritter Eintrag
```

:::
````

:::typst{mode="preview"}

```typ
= Hallo Welt!

Dies ist ein einfaches Typst-Dokument.

- Erster Eintrag
- Zweiter Eintrag
- Dritter Eintrag
```

:::

### Bearbeitungsmodus

Im Bearbeitungsmodus wird ein Editor neben der Vorschau angezeigt, sodass Benutzer den Typst-Code ändern und Live-Updates sehen können.

````md
:::typst{mode="edit"}

```typ
= Interaktives Dokument

Du kannst diesen Text bearbeiten und die Änderungen live sehen!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::
````

:::typst{mode="edit"}

```typ
= Interaktives Dokument

Du kannst diesen Text bearbeiten und die Änderungen live sehen!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::

### Laden aus externen Dateien

Du kannst Typst-Quelldateien aus externen Quellen laden, indem du spezielle Direktiven verwendest. Assets wie Bilder werden automatisch vom Server oder von Remote-Adressen geladen.

#### Laden von Quelldateien

Verwende `::file{path="…" src="…"}`, um Typst-Quelldateien zu laden, die in dein Hauptdokument eingebunden werden können:

````md
:::typst{mode="preview"}

::file{path="other.typ" src="typst-doc.typ"}

```typ
= Hauptdokument

#include "/other.typ"
```
:::
````

:::typst{id="dcb47be943118f120f83e5b3b449bceee800f6e62f21c1937a81995706782106" mode="preview"}

::file{path="other.typ" src="typst-doc.typ"}

```typ
= Hauptdokument

#include "/other.typ"
```
:::

#### Laden von Bildern

Bilder, die in deinem Typst-Code referenziert werden, werden automatisch vom Server oder von Remote-URLs geladen:

````md
:::typst{mode="preview"}

```typ
= Dokument mit Bild

#figure(
  image("my-image.jpg", width: 80%),
  caption: "Mein Bild"
)
```
:::
````

#### Suchpfade für Dateien

Dateien, die im `src`-Attribut von `::file` referenziert werden, sowie Bilder, die in `image()`-Aufrufen referenziert werden, werden wie folgt aufgelöst:

- **Absolute Pfade** (beginnend mit `/`): Der `basePath` wird dem Pfad vorangestellt
- **Relative Pfade**: Werden relativ zum Verzeichnis der aktuellen Seite (`pagePath`) aufgelöst

### Laden von Schriftarten

Verwende `::file` mit dem Schalter `font`, um benutzerdefinierte Schriftarten für deine Typst-Dokumente zu laden. Nur `.otf` (OpenType) und `.ttf` (TrueType) Schriftarten werden unterstützt.

````md
:::typst{mode="preview"}

::file{src="/fonts/FiraSans-Regular.otf" font}

```typ
#set text(font: "Fira Sans")

= Beispiel mit benutzerdefinierter Schriftart

Dieser Text verwendet die Fira Sans Schriftart.
```
:::
````

#### Emoji-Unterstützung

Für Emoji-Unterstützung in Typst musst du die NotoColorEmoji-Schriftart laden:

````md
:::typst{mode="preview"}

::file{src="/fonts/NotoColorEmoji.ttf" font}

```typ
= Emoji-Beispiel

Hallo Welt! 🎉🚀✨
```
:::
````

#### Wiederverwendung von Schriftarten mit Snippets

Um Schriftarten in vielen Typst-Instanzen wiederzuverwenden, empfiehlt es sich, ein Snippet zu erstellen. Erstelle eine Datei `fonts.md.hbs` im `snippets`-Ordner:

```hbs
::file{src="/fonts/NotoColorEmoji.ttf" font}
::file{src="/fonts/FiraSans-Regular.otf" font}
```

Dann verwende das Snippet in deinen Typst-Blöcken:

````md
:::typst

::snippet{#fonts}

```typ
#set text(font: "Fira Sans")

= Dokument mit benutzerdefinierten Schriftarten

Dieser Text verwendet Fira Sans und unterstützt Emojis! 🎉
```

:::
````

#### Mehrere Quelldateien

Du kannst mehrere Quelldateien definieren, indem du benannte Code-Blöcke verwendest:

````md
:::typst{mode="preview"}

```typ
= Hauptdokument

#include "/helper.typ"
```

```typ file="helper.typ"
= Hilfsinhalt

Dieser Inhalt befindet sich in einer separaten Datei.
```
:::
````

## Beispiele

### Mathematische Formeln

````md
:::typst{mode="preview" height="300px"}

```typ
= Mathematische Formeln

Typst unterstützt schönen mathematischen Formelsatz:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

Die quadratische Formel:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```
:::
````

:::typst{mode="preview" height="300px"}

```typ
= Mathematische Formeln

Typst unterstützt schönen mathematischen Formelsatz:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

Die quadratische Formel:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```
:::

### Tabellen

````md
:::typst{mode="preview" height="250px"}
```typ
= Datentabelle

#table(
  columns: (auto, auto, auto),
  [*Name*], [*Alter*], [*Stadt*],
  [Alice], [25], [Berlin],
  [Bob], [30], [München],
  [Carol], [28], [Hamburg],
)
```
:::
````

:::typst{mode="preview" height="250px"}
```typ
= Datentabelle

#table(
  columns: (auto, auto, auto),
  [*Name*], [*Alter*], [*Stadt*],
  [Alice], [25], [Berlin],
  [Bob], [30], [München],
  [Carol], [28], [Hamburg],
)
```
:::

### Komplexes Beispiel mit mehreren Dateien

Dieses Beispiel demonstriert das Laden von Quelldateien mit mehreren benannten Typst-Dateien:

````md
:::typst{mode="preview" height="250px"}

```typ
= Code-Beispiel

Hier ist etwas Inline-`Code` und ein Code-Block:

#raw(block: true, lang: "python",
"def hello():
    print('Hallo Welt!')")

#figure(
  image("test.jpg", width: 80%),
  caption: "Eine komplexe Abbildung mit einem Bild."
)

#include "/other.typ"
```

```typ file="other.typ"
= Zusätzlicher Inhalt

#figure(
  image("test.jpg", width: 80%),
  caption: "Eine weitere Ansicht des Bildes."
)
```
:::
````

:::typst{id="f04db1b387b940fc254f6298f71d6a0a8ca23facc79b5ae4afbbb290afaa1917" mode="preview" height="250px"}

```typ file="main.typ"
= Code-Beispiel

Hier ist etwas Inline-`Code` und ein Code-Block:

#raw(block: true, lang: "python",
"def hello():
    print('Hallo Welt!')")

#figure(
  image("/test.jpg", width: 80%),
  caption: "Eine komplexe Abbildung mit einem Bild."
)

#include "/other.typ"

```

```typ file="other.typ"
= Ein weiterer Code-Block

#figure(
  image("/test.jpg", width: 80%),
  caption: "Eine komplexe Abbildung mit einem Bild."
)
```
:::

## Dateien, die Leserinnen und Leser ändern dürfen

Mit `files` bekommen Leserinnen und Leser Knöpfe für eigene Dateien: **+** legt eine Datei an, **⤒** lädt eine hoch, und jeder Tab bekommt **✎** zum Umbenennen und **×** zum Löschen. `rename` und `delete` erlauben das auch für die Dateien der Seite; die Hauptdatei sowie `readonly`-, `hidden`- und Testdateien bleiben immer, wie sie geschrieben sind. Selbst angelegte oder hochgeladene Dateien dürfen Leserinnen und Leser immer umbenennen und löschen. Ein Klick auf den Tab einer Binärdatei zeigt eine Vorschau: Bilder, Audio und Video, PDFs, Schriftarten (TTF, OTF, WOFF) und 3D-Modelle (STL, OBJ), die sich drehen und zoomen lassen.

````md
:::typst{files="create,upload,rename,delete"}
...
:::
````

## Umstieg von der alten Schreibweise

Ältere Bücher laden Dateien mit `@source`-, `@file`- und `@font`-Zeilen und benennen Codeblöcke nur über ihre Meta-Angabe (```` ```typ other.typ ````). Führe in deinem Buch `npx hyperbook migrate` aus, um diese Seiten und die verwendeten Snippets umzustellen; gespeicherte Dokumente der Leserinnen und Leser bleiben dabei erhalten.
