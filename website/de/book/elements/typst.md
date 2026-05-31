---
name: Typst
permaid: typst
---

# Typst

:::alert{warn}
**Erfordert eine Netzwerkverbindung.** Der Typst-WebAssembly-Compiler (~28 MB), der Renderer (~1 MB) und das JavaScript-Bundle (~1,4 MB) werden zur Laufzeit von `cdn.jsdelivr.net` geladen und sind nicht im Hyperbook-Build-Output enthalten. Dieses Element funktioniert nicht in Offline- oder netzwerkbeschränkten Umgebungen.
:::

Die Typst-Direktive ermöglicht es dir, [Typst](https://typst.app/)-Dokumente direkt in deinem Hyperbook zu rendern. Typst ist ein modernes Markup-basiertes Satzsystem, das einfach zu erlernen ist und schöne Dokumente erzeugt.

## Optionen

| Option | Beschreibung | Standard |
|--------|--------------|----------|
| `id` | Eindeutiger Bezeichner für den Typst-Block | Automatisch generiert |
| `mode` | Anzeigemodus: `preview` (nur Ansicht) oder `edit` (mit Editor) | `preview` |
| `height` | Höhe des Vorschau-Containers | `auto` |

## Wichtige Hinweise

- **Mehrere Typst-Blöcke**: Wenn mehrere Typst-Blöcke auf derselben Seite vorhanden sind, werden sie nacheinander gerendert (einer nach dem anderen), um die Dateiisolierung zu gewährleisten. Jeder Block behält sein eigenes unabhängiges Dateisystem während des Renderns bei.
- **Dateiisolierung**: Dateien, die in einem Typst-Block geladen werden (über `@source`), sind vollständig von anderen Blöcken auf derselben Seite isoliert. Das bedeutet, dass du denselben Dateinamen (z.B. `other.typ`) in verschiedenen Blöcken ohne Konflikte verwenden kannst.


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

Verwende die `@source`-Direktive, um Typst-Quelldateien zu laden, die in dein Hauptdokument eingebunden werden können:

````md
:::typst{mode="preview"}

@source dest="other.typ" src="typst-doc.typ"

```typ
= Hauptdokument

#include "/other.typ"
```
:::
````

:::typst{mode="preview"}

@source dest="other.typ" src="typst-doc.typ"

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

Dateien, die in `src`-Attributen (für `@source`- und `@font`-Direktiven) referenziert werden, sowie Bilder, die in `image()`-Aufrufen referenziert werden, werden wie folgt aufgelöst:

- **Absolute Pfade** (beginnend mit `/`): Der `basePath` wird dem Pfad vorangestellt
- **Relative Pfade**: Werden relativ zum Verzeichnis der aktuellen Seite (`pagePath`) aufgelöst

### Laden von Schriftarten

Verwende die `@font`-Direktive, um benutzerdefinierte Schriftarten für deine Typst-Dokumente zu laden. Nur `.otf` (OpenType) und `.ttf` (TrueType) Schriftarten werden unterstützt.

````md
:::typst{mode="preview"}

@font src="/fonts/FiraSans-Regular.otf"

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

@font src="/fonts/NotoColorEmoji.ttf"

```typ
= Emoji-Beispiel

Hallo Welt! 🎉🚀✨
```
:::
````

#### Wiederverwendung von Schriftarten mit Snippets

Um Schriftarten in vielen Typst-Instanzen wiederzuverwenden, empfiehlt es sich, ein Snippet zu erstellen. Erstelle eine Datei `fonts.md.hbs` im `snippets`-Ordner:

```hbs
@font src="/fonts/NotoColorEmoji.ttf"
@font src="/fonts/FiraSans-Regular.otf"
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

```typ main.typ
= Hauptdokument

#include "/helper.typ"
```

```typ helper.typ
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

```typ main.typ
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

```typ other.typ
= Zusätzlicher Inhalt

#figure(
  image("test.jpg", width: 80%),
  caption: "Eine weitere Ansicht des Bildes."
)
```
:::
````

:::typst{mode="preview" height="250px"}

```typ main.typ
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

```typ other.typ
= Ein weiterer Code-Block

#figure(
  image("/test.jpg", width: 80%),
  caption: "Eine komplexe Abbildung mit einem Bild."
)
```
:::
