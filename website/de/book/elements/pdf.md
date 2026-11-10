---
name: PDF
lang: de
---

# PDF

Zeigt ein PDF-Dokument auf der Seite: ein Skript, ein Arbeitsblatt, einen
Foliensatz. Die Seiten werden im Browser gezeichnet und funktionieren deshalb
auch auf Tablets und Smartphones, auf denen ein eingebettetes PDF meist nur die
erste Seite zeigt. Der Text lässt sich markieren, durchsuchen und vorlesen.

```md
::pdf[Arbeitsblatt]{src="/example.pdf"}
```

::pdf[Arbeitsblatt]{src="/example.pdf"}

Der Text in `[]` ist der Titel. Ohne JavaScript ist das Element ein Link auf
die Datei.

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `src` | Pfad zum PDF. Ein Pfad mit führendem Schrägstrich wird vom Wurzelverzeichnis des Buchs aus gesucht (Ordner `public` und `book`), jeder andere neben der Seite. | - |
| `view` | Wie das Dokument gezeigt wird: `pages`, `slides`, `thumb`, `embed` oder `button`, siehe unten. | `pages` |
| `pages` | Die Seiten, die gezeigt werden, zum Beispiel `1-2` oder `3,5-6`. `4-` reicht bis zur letzten Seite. | alle |
| `download` | `false` blendet den Download-Button aus. | `true` |
| `height` | Die Höhe der Ansichten `slides` und `embed`, zum Beispiel `400` oder `60vh`. | passend zur Seite |

## Ansichten

### pages

Alle Seiten untereinander, so breit wie der Text. Das ist der Standard. Seiten
werden gezeichnet, sobald sie in den sichtbaren Bereich kommen; ein langes
Dokument bremst die Seite also nicht.

```md
::pdf[Arbeitsblatt, Seiten 2 und 3]{src="/example.pdf" pages="2-3"}
```

::pdf[Arbeitsblatt, Seiten 2 und 3]{src="/example.pdf" pages="2-3"}

### slides

Eine Seite nach der anderen, mit Buttons für die vorherige und die nächste
Seite und für den Vollbildmodus. Liegt der Fokus auf dem Dokument, blättern die
Pfeiltasten; auf einem Touchscreen reicht ein Wischen.

```md
::pdf[Folien]{src="/example-slides.pdf" view="slides"}
```

::pdf[Folien]{src="/example-slides.pdf" view="slides"}

### thumb

Die erste Seite als kleines Bild neben Titel und Download-Button. Ein Klick auf
das Bild öffnet das Dokument.

```md
::pdf[Arbeitsblatt]{src="/example.pdf" view="thumb"}
```

::pdf[Arbeitsblatt]{src="/example.pdf" view="thumb"}

### embed

Der PDF-Betrachter des Browsers in einem Rahmen, mit Zoom, Suche und Drucken.
Nur für Leser am Desktop geeignet: Die meisten mobilen Browser zeigen von einem
eingebetteten PDF nur die erste Seite oder starten einen Download.

```md
::pdf[Arbeitsblatt]{src="/example.pdf" view="embed" height="500"}
```

### button

Nur ein Download-Button, wie bei [Download](/elements/download).

```md
::pdf[Arbeitsblatt (PDF)]{src="/example.pdf" view="button"}
```

::pdf[Arbeitsblatt (PDF)]{src="/example.pdf" view="button"}

## Typst-Dokumente

`src` kann auch ein [Typst](https://typst.app)-Dokument sein. Der Build macht
daraus ein PDF, das dann wie jedes andere gezeigt wird:

```md
::pdf[Arbeitsblatt]{src="arbeitsblatt.typ"}
::pdf[Lösung]{src="arbeitsblatt.typ" inputs="loesung=true"}
```

- Das Dokument wird mit dem Wurzelverzeichnis des Buchs als Typst-Root
  übersetzt: `#import "/vorlagen/kopf.typ"` und Bilder funktionieren von
  überall im Buch, und nichts außerhalb des Buchs kann gelesen werden.
- `inputs` übergibt dem Dokument Werte, die es mit
  `sys.inputs.at("loesung", default: "false")` liest. Jede Kombination von
  inputs ist ein eigenes PDF.
- Eine `.typ`-Datei selbst wird nie veröffentlicht, außer eine Seite bietet sie
  mit [Download](/elements/download) an: `:download[Vorlage]{src="vorlage.typ"}`.
  Um nur das PDF zum Herunterladen anzubieten, nimm `view="button"`.
- Ein unverändertes Dokument wird nicht noch einmal übersetzt. Ein Dokument mit
  Fehlern lässt den Build scheitern, mit der Meldung von Typst.
- Der Dev-Server übersetzt ein Dokument, sobald eine Seite es zeigt.

Welche Typst-Version das Buch baut und wo seine Pakete und Schriften liegen,
steht in der `hyperbook.json`:

```json
{
  "typst": {
    "version": "0.15.1",
    "packagePath": "typst-pakete",
    "fontPath": "schriften"
  }
}
```

| Option | Beschreibung |
|---|---|
| `version` | Die Typst-Version, eine der von Hyperbook unterstützten (0.15.0 und neuer). Hyperbook lädt sie beim ersten Gebrauch herunter. Ohne Angabe wird die neueste genommen, mit einer Warnung: Lege sie fest, damit das Buch später genauso gebaut wird. |
| `packagePath` | Ein Ordner im Buch mit Typst-Paketen im Aufbau `<namespace>/<name>/<version>/`. Importe `@local/<name>:<version>` kommen aus `local/`; Pakete aus Typst Universe, die das Buch mitbringt, liegen in `preview/`. Andere `@preview`-Pakete lädt Typst herunter. |
| `fontPath` | Ein Ordner im Buch mit Schriften. Auf dem Rechner installierte Schriften werden nicht benutzt, damit das Buch überall gleich aussieht. |

Pakete für mehrere Bücher können in einem gemeinsamen Ordner außerhalb liegen:
Setze die Umgebungsvariable `HYPERBOOK_TYPST_PACKAGE_PATH` auf ihn. Ein Paket im
eigenen `packagePath` des Buchs gewinnt gegen ein gemeinsames mit gleichem
Namen und gleicher Version. `HYPERBOOK_TYPST_BINARY` nimmt ein anderes
`typst`-Programm als das heruntergeladene.

## Was `pages` und `download` nicht tun

:::alert{warn}
`pages` und `download="false"` ändern, was gezeigt wird, nicht was
veröffentlicht ist. Der Browser lädt die ganze Datei, um zwei Seiten davon zu
zeigen, und die Adresse der Datei steht in der Seite. Ein Arbeitsblatt mit der
Lösung auf der letzten Seite gibt die Lösung jedem, der die Datei öffnet.
Lösungen gehören in ein eigenes Dokument. Dasselbe gilt in einem
[protect](/elements/protect)-Block: Er verbirgt den Betrachter, nicht die
Datei.
:::

Dateien, die gar nicht Teil der Seite sein sollen, hält
[`exclude`](/configuration/book) heraus.

## Konfiguration

Der Betrachter ([pdf.js](https://mozilla.github.io/pdf.js/)) wird einmal
heruntergeladen und in dein Buch kopiert. Um ihn stattdessen von einem CDN zu
laden, setze `cdn` auf `true` oder auf die Adresse deiner eigenen Kopie:

```json
{
  "elements": {
    "pdf": {
      "cdn": true
    }
  }
}
```
