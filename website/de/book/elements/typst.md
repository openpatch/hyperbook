---
name: Typst
permaid: typst
---

# Typst

Die Typst-Direktive ermöglicht es, [Typst](https://typst.app/)-Dokumente direkt in Ihrem Hyperbook zu rendern. Typst ist ein modernes, Markup-basiertes Satzsystem, das leicht zu erlernen ist und schöne Dokumente erstellt.

## Verwendung

Um die Typst-Direktive zu verwenden, umschließen Sie Ihren Typst-Code in einem `:::typst`-Block mit einem Code-Block, der die Sprache `typ` oder `typst` verwendet.

### Vorschau-Modus

Im Vorschau-Modus wird nur die gerenderte Ausgabe angezeigt, zusammen mit einer Download-Schaltfläche zum Exportieren als PDF.

````md
:::typst{mode="preview"}

```typ
= Hallo Welt!

Dies ist ein einfaches Typst-Dokument.

- Erster Punkt
- Zweiter Punkt
- Dritter Punkt
```

:::
````

:::typst{mode="preview"}

```typ
= Hallo Welt!

Dies ist ein einfaches Typst-Dokument.

- Erster Punkt
- Zweiter Punkt
- Dritter Punkt
```

:::

### Bearbeiten-Modus

Im Bearbeiten-Modus wird ein Editor neben der Vorschau angezeigt, mit dem Benutzer den Typst-Code ändern und Live-Updates sehen können.

````md
:::typst{mode="edit"}

```typ
= Interaktives Dokument

Sie können diesen Text bearbeiten und die Änderungen live sehen!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::
````

:::typst{mode="edit"}

```typ
= Interaktives Dokument

Sie können diesen Text bearbeiten und die Änderungen live sehen!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::

## Optionen

| Option | Beschreibung | Standard |
|--------|--------------|----------|
| `mode` | Anzeigemodus: `preview` (nur Ansicht) oder `edit` (mit Editor) | `preview` |
| `height` | Höhe des Vorschau-Containers. Akzeptiert CSS-Werte wie `100px`, `50vh`, `calc(100dvh - 200px)` | `auto` für preview, `calc(100dvh - 128px)` für edit |
| `src` | Pfad zu einer externen `.typ`-Datei | - |

### Laden aus externer Datei

Sie können Typst-Code aus einer externen Datei laden, indem Sie das `src`-Attribut verwenden:

````md
:::typst{mode="preview" src="dokument.typ"}
:::
````

Die Datei wird in folgenden Verzeichnissen gesucht (in dieser Reihenfolge):
1. `public/`-Verzeichnis
2. `book/`-Verzeichnis
3. Verzeichnis der aktuellen Seite

## Beispiele

### Mathematische Formeln

:::typst{mode="preview" height=300}

```typ
= Mathematische Formeln

Typst unterstützt schöne mathematische Formeln:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

Die quadratische Formel:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```

:::

### Tabellen

:::typst{mode="preview" height=250}

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

### Code-Blöcke

:::typst{mode="preview" height=200}

```typ
= Code-Beispiel

Hier ist etwas Inline-`Code` und ein Code-Block:

#raw(block: true, lang: "python",
"def hallo():
    print('Hallo, Welt!')")
```

:::
