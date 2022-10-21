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
