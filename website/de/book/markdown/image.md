---
name: Bild
lang: de
---

# Bild

Um Bilder hinzuzufügen, kannst du dieses Element verwenden. Der Pfad zu lokalen
Bildern muss mit einem Slash (/) beginnen. Diese werden vom public-Ordner geladen.
Natürlich kannst du auch externe Bilder referenzieren.

```md
![](/test.jpg)
```

![](/test.jpg)

Du kannst auch eine Beschreibung dem Bild hinzufügen. Diese wird für
Screenreader verwendet.

```md
![Eine Beschreibung](/test.jpg)
```

![A description](/test.jpg)

Du kannst auch eine sichtbare Beschreibung dem Bild hinzufügen.

```md
![Eine Beschreibung](/test.jpg "Eine sichtbare Beschreibung")
```

![Eine Beschreibung](/test.jpg "Eine sichtbare Beschreibung")

Wenn du ein Bild verlinken möchtest, kannst du die normale Link-Syntax verwenden.

```md
[![Eine Beschreibung](/test.jpg "Eine sichtbare Beschreibung")](/elements/alert)
```

[![Eine Beschreibung](/test.jpg "Eine sichtbare Beschreibung")](/elements/alert)

:::alert{info}
Wenn dein Hyperbook die [basePath](/configuration/book) Option verwendet, dann wird diese automatisch hinzugefügt.
:::

## Position und Gestaltung anpassen

Du kannst die Position und Gestaltung deiner Bilder anpassen, indem du spezielle Zeichen vor oder nach dem Bild-Markdown hinzufügst.
Benutzerdefinierte Klassen und Attribute können durch die Verwendung von geschweiften Klammern `{}` nach dem Bild-Markdown hinzugefügt werden.

```md
![](/test.jpg){#hero .rounded width="200"}
```

Dies fügt ein Bild mit der ID `hero`, der Klasse `rounded` und einer Breite von `200px` hinzu.

:::alert{info}
Dies wird am besten mit benutzerdefinierten CSS-Stilen verwendet.
:::

Du kannst dein Bild auch links, rechts oder zentriert ausrichten, indem du spezielle Zeichen vor oder nach dem Bild-Markdown hinzufügst.

zentriert: `![](/test.jpg)`

links: `-![](/test.jpg)`

links erweitert: `--![](/test.jpg)`

rechts: `![](/test.jpg)-`

rechts erweitert: `![](/test.jpg)--`

zentriert erweitert: `--![](/test.jpg)--`

Du kannst alle Optionen auf dieser [Beispielseite](./image-styling) überprüfen.
