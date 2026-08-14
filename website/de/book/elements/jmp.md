---
name: Java Memory Playground
permaid: jmp
---

# Java Memory Playground

Das `jmp`-Element bettet den [Java Memory Playground](https://jmp.openpatch.org) ein — ein Diagramm
von Stack und Heap, das deine Leserinnen und Leser auseinandernehmen und selbst wieder aufbauen
können. Du musst dafür **kein** HTML schreiben.

## Grundlegende Verwendung

Lege eine `.jmp`-Datei neben deine Seite (oder nach `public/`) und verweise darauf:

````markdown
::jmp{id="jmp-example" height="600px" src="memory.jmp"}
````

::jmp{id="jmp-example" height="600px" src="memory.jmp"}

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `id` | Eine eindeutige Kennung für die Playground-Instanz | automatisch |
| `height` | Die Höhe des Containers, z.B. `600px` oder `100%` | `600px` |
| `src` | Der Pfad zur `.jmp`-Datei | - |
| `step` | Der zuerst gezeigte Schritt, beginnend bei 0 | erster Schritt |
| `language` | Sprache der Oberfläche, `en` oder `de` | die Sprache des Buchs |

### Optionen

Eine `.jmp`-Datei bringt ihre eigenen Optionen mit. Diese Attribute überschreiben sie, sodass
dasselbe Diagramm auf einer Seite eine bearbeitbare Aufgabe und auf einer anderen ein Bild zum
Anschauen sein kann. Schreibe das Attribut allein, um eine Option einzuschalten, oder `="false"`, um
sie auszuschalten.

| Attribut | Beschreibung |
|---|---|
| `hide-sidebar` | Die Palette der Klassen auf der linken Seite ausblenden |
| `hide-call-method` | Den Eintrag "Methode aufrufen" in der Seitenleiste ausblenden |
| `hide-declare-global-variable` | Den Eintrag "Globale Variable deklarieren" ausblenden |
| `hide-new-array` | Den Eintrag "new Array" ausblenden |
| `disable-garbage-collector` | Den Knopf für die Garbage Collection ausblenden |
| `create-new-on-edge-drop` | Ein neues Objekt anlegen, wenn eine Referenz auf leere Fläche gezogen wird |
| `inline-strings` | String-Werte im referenzierenden Objekt zeichnen statt als eigenes Objekt auf dem Heap. Standardmäßig an |
| `hide-steps` | Die Schrittleiste ausblenden, für eine Seite, auf der es um ein einziges Bild geht |
| `hide-step-changes` | Nicht mehr markieren, was ein Schritt gegenüber dem vorherigen verändert hat |
| `gc-prediction` | Vor dem Aufräumen fragen, welche Objekte unerreichbar sind |

Für eine Abbildung, die nur betrachtet werden soll:

````markdown
::jmp{src="memory.jmp" hide-sidebar disable-garbage-collector}
````

## Speichern und Zurücksetzen

Was jemand baut, wird im Browser gespeichert und ist beim nächsten Besuch noch da — dafür muss
niemand auf **Speichern** drücken. Der Knopf unten rechts verwirft diese Fassung und stellt das
Diagramm wieder her, das du ausgeliefert hast.

## Schritte

Eine `.jmp`-Datei kann statt eines einzelnen Bildes eine Folge von Schritten enthalten. So zeigt ein
Diagramm, wie ein Kellerrahmen angelegt und wieder abgeräumt wird, oder wie ein Objekt in dem Moment
zu Müll wird, in dem die letzte Referenz darauf verschwindet. Ein als Aufgabe markierter Schritt ist
einer, den die Lesenden selbst bauen; **Prüfen** vergleicht ihr Ergebnis mit deiner Lösung.

## Editor

Zum Erstellen eines Diagramms nutzt du den Playground selbst: Öffne
[jmp.openpatch.org](https://jmp.openpatch.org), hänge `?edit` an für die Lehrkraft-Ansicht und
klicke auf **Save (URL)** — das Diagramm steht dann in der Adresszeile und lässt sich als
`.jmp`-Datei herunterladen.

Das Projekt enthält außerdem eine VS-Code-Erweiterung, die `.jmp`-Dateien als Diagramm statt als
JSON öffnet: [Java Memory Playground Studio](https://github.com/openpatch/java-memory-playground/tree/main/platforms/vscode)
