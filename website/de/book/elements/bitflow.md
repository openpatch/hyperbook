---
name: Bitflow
permaid: bitflow
---

# Bitflow

Das `bitflow`-Element bettet eine [bitflow](https://bitflow.openpatch.org)-Lernkontrolle ein — eine
Abfolge von Aufgaben, die deine Leserinnen und Leser bearbeiten und die dabei ausgewertet wird. Das
passt gut als Überprüfung am Ende eines Kapitels. Du musst dafür **kein** HTML schreiben.

## Grundlegende Verwendung

Lege eine Flow-Datei neben deine Seite (oder nach `public/`) und verweise mit dem Element darauf:

```markdown
::bitflow{id="bitflow-example" height="600px" src="quiz.json"}
```

::bitflow{id="bitflow-example" height="600px" src="quiz.json"}

## Attribute

| Attribut   | Beschreibung                                          | Standard            |
| ---------- | ----------------------------------------------------- | ------------------- |
| `id`       | Eindeutige Kennung für diesen Flow                    | automatisch erzeugt |
| `height`   | Höhe des Containers, zum Beispiel `600px` oder `100%` | `600px`             |
| `src`      | Pfad zur Flow-Datei                                   | -                   |
| `locale`   | Sprache der Oberfläche (siehe unten)                  | Sprache des Buches  |
| `readonly` | Den Flow anzeigen, ohne Antworten anzunehmen          | aus                 |

Der Flow wird beim Bauen des Buches gelesen, nicht vom Browser der Lesenden geladen. Eine fehlende
oder fehlerhafte Datei wird beim Bauen als Warnung mit Seite und Zeile gemeldet, du erfährst also
beim Schreiben davon und nicht erst von Lesenden, die auf eine leere Stelle schauen. Ein gebautes
Buch braucht kein Netz, um eine Lernkontrolle zu öffnen. Der Build läuft trotzdem durch — das Element
zeigt dann einfach nichts an — sieh also in die Build-Ausgabe, wenn eine Lernkontrolle fehlt.

Die Knöpfe und Rückmeldungen des Flows sind auf `en`, `de`, `fr`, `nl`, `es`, `it`, `pt` und `tr`
übersetzt. Ein Buch in einer anderen Sprache bekommt die englischen Texte — die Aufgaben selbst sind
immer das, was du im Flow geschrieben hast.

## Speichern und neu beginnen

Antworten werden während des Bearbeitens im Browser gespeichert und sind auch beim nächsten Besuch
noch da. Der Knopf unten rechts verwirft den Versuch und beginnt einen neuen.

Wenn du den Flow änderst und das Buch neu baust, passt ein zur alten Fassung gespeicherter Versuch
nicht mehr. Statt einen halb wiederhergestellten Versuch zu zeigen, beginnt das Element dann still
einen neuen.

## Was Lesende herunterladen

Ein Flow lädt nur die Aufgabentypen, die er wirklich verwendet. Eine Seite mit drei
Multiple-Choice-Fragen bezahlt nicht für die Mathematik-Aufgabe, die einen Formeleditor mitbringt.
Auf einer Seite ohne `bitflow`-Element wird gar nichts geladen.

## Erstellen

Baue einen Flow auf [bitflow.openpatch.org](https://bitflow.openpatch.org) und speichere ihn als
Datei neben deiner Seite. Die Autorenansicht ist nicht Teil des Buches — Lesende sehen immer nur den
Flow selbst.
