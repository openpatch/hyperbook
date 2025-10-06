---
name: Lernkarte
permaid: lernkarte
---

# Lernkarte

Das `learningmap`-Element ermöglicht es dir, interaktive Lernfahrpläne direkt in deine Markdown-Dateien einzubetten. Du musst **kein** HTML schreiben.

## Grundlegende Verwendung

Um eine Lernkarte hinzuzufügen, verwende folgenden Markdown-Block:

````markdown
:::learningmap

```yaml
title: Moderne Webentwicklung Fahrplan
background:
  color: '#f8fafc'
  image:
    src: 'learningmap.svg'
    x: 0
    y: 0
edges:
  animated: false
  color: '#94a3b8'
  width: 2
  type: bezier
nodes:
  - id: '1'
    type: topic
    data:
      label: Einführung in HTML
      description: |
        Verstehe die Struktur und Semantik von HTML-Dokumenten.
      duration: 1 Stunde
      unlock: {}
      completion:
        needs:
          - id: "2"
            source: bottom
            target: top
        optional:
          - id: "3"
            source: bottom
            target: top
      video: https://youtube.com/watch?v=UB1O30fR-EE
      resources:
        - label: MDN HTML Einführung
          url: https://developer.mozilla.org/en-US/docs/Web/HTML
        - label: HTML Grundlagen Tutorial
          url: https://www.w3schools.com/html/
  - id: '2'
    type: task
    data:
      label: Schreibe deine erste HTML-Datei
      description: Erstelle eine einfache HTML-Seite.
      duration: 1 Stunde
      resources:
        - label: HTML Seiten Anleitung
          url: https://www.freecodecamp.org/news/how-to-build-your-first-web-page/
  - id: '3'
    type: task
    data:
      label: Füge eine Überschrift und einen Absatz hinzu
      description: Füge grundlegende Elemente zu deiner HTML-Seite hinzu.
      duration: 1 Stunde
      unlock:
        after:
          - "2"
      resources:
        - label: HTML Elemente
          url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
```
:::
````

:::learningmap

```yaml
title: Moderne Webentwicklung Fahrplan
background:
  color: '#f8fafc'
  image:
    src: 'learningmap.svg'
    x: 0
    y: 0
edges:
  animated: false
  color: '#94a3b8'
  width: 2
  type: bezier
nodes:
  - id: '1'
    type: topic
    data:
      label: Einführung in HTML
      description: |
        Verstehe die Struktur und Semantik von HTML-Dokumenten.
      duration: 1 Stunde
      unlock: {}
      completion:
        needs:
          - id: "2"
            source: bottom
            target: top
        optional:
          - id: "3"
            source: bottom
            target: top
      video: https://youtube.com/watch?v=UB1O30fR-EE
      resources:
        - label: MDN HTML Einführung
          url: https://developer.mozilla.org/en-US/docs/Web/HTML
        - label: HTML Grundlagen Tutorial
          url: https://www.w3schools.com/html/
  - id: '2'
    type: task
    data:
      label: Schreibe deine erste HTML-Datei
      description: Erstelle eine einfache HTML-Seite.
      duration: 1 Stunde
      resources:
        - label: HTML Seiten Anleitung
          url: https://www.freecodecamp.org/news/how-to-build-your-first-web-page/
  - id: '3'
    type: task
    data:
      label: Füge eine Überschrift und einen Absatz hinzu
      description: Füge grundlegende Elemente zu deiner HTML-Seite hinzu.
      duration: 1 Stunde
      unlock:
        after:
          - "2"
      resources:
        - label: HTML Elemente
          url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
```
:::

## Höhe einstellen

Du kannst die Höhe der Lernkarte festlegen, indem du ein `height`-Attribut in geschweiften Klammern nach `learningmap` angibst:

````markdown
:::learningmap{height="600px"}

```yaml
# roadmap data here
```
:::
````

- Wenn du das `height`-Attribut **nicht** setzt, verwendet das Element standardmäßig die volle Höhe des Viewports.

## Knoten mit Kanten verbinden

- Knoten werden automatisch mit Kanten verbunden, basierend auf der `completion`-Eigenschaft von Themenknoten.
- Die Needs-Liste in der `completion`-Eigenschaft definiert, welche Knoten abgeschlossen sein müssen, bevor das Thema als abgeschlossen gilt.
- Du kannst die Position der Kanten mit den Eigenschaften `source` und `target` (oben, unten, links, rechts) anpassen.

## Automatisches Knoten-Layout

- Wenn ein Knoten **keine** `position` angibt (kein `x` und `y`), wird er automatisch vom Layout-Algorithmus platziert.
- So bleibt dein Fahrplan organisiert, auch wenn du manuelle Positionen weglässt.

## Knotentypen: Thema und Aufgabe

Das Lernkarten-Element unterstützt zwei Knotentypen:

- **Themenknoten** (`type: topic`)
- **Aufgabenknoten** (`type: task`)

**Aufgabenknoten**
- Stellen einzelne Aktivitäten oder Aufgaben dar.
- Sollten **keine** `completion`-Eigenschaft haben.
- Werden direkt vom Benutzer abgeschlossen.

**Themenknoten**
- Stellen größere Themen oder Module dar.
- Sollten eine `completion`-Eigenschaft enthalten.
- Ein Themenknoten gilt als abgeschlossen, wenn alle zugehörigen Aufgaben oder Unterthemen abgeschlossen sind.
- Die `completion`-Eigenschaft listet die erforderlichen Knoten (nach `id`) auf, die abgeschlossen sein müssen, damit das Thema als abgeschlossen gilt. Füge `target` und `source` hinzu, um die Richtung der Kantenverbindungen anzupassen. Du kannst `bottom`, `top`, `left` oder `right` setzen.

**Beispiel:**

````yaml
nodes:
  - id: '1'
    type: topic
    position:
      x: 0
      y: 0
    data:
      label: "HTML lernen"
      completion:
        needs:
          - id: "2"
          - id: "3"
  - id: '2'
    type: task
    position:
      x: -150
      y: 150
    data:
      label: "Schreibe deine erste HTML-Datei"
  - id: '3'
    type: task
    data:
      label: "Füge eine Überschrift und einen Absatz hinzu"
````

In diesem Beispiel wird das Thema "HTML lernen" erst als abgeschlossen markiert, wenn beide Aufgaben ("Schreibe deine erste HTML-Datei" und "Füge eine Überschrift und einen Absatz hinzu") abgeschlossen sind.

## Kanten-Anpassung

Du kannst das Aussehen der Kanten, die Knoten verbinden, mit der `edges`-Eigenschaft anpassen:

````yaml
edges:
  animated: true
  color: '#ff0000'
  width: 3
  type: bezier
````

- `animated`: Setze auf `true`, um animierte Kanten zu aktivieren. Dadurch werden alle Kanten gestrichelt und animiert.
- `color`: Definiere die Farbe der Kanten mit einem Hex-Code.
- `width`: Lege die Breite der Kanten in Pixeln fest.
- `type`: Wähle den Typ der Kante. Optionen sind `bezier` oder `smoothstep`.

## Freischaltbedingungen

Knoten können basierend auf folgenden Bedingungen gesperrt oder freigeschaltet werden:

- Abschluss anderer Knoten (`after`)
- Bestimmte Daten (`date`)
- Passwörter (`password`)

**Beispiel:**

````yaml
unlock:
  after:
    - "1"
  date: "2025-10-01"
  password: "webdev2025"
````

## Fortschrittsanzeige

- Benutzer können Knoten als gestartet oder abgeschlossen markieren.
- Der Fortschritt wird oben auf der Karte angezeigt.
- Der Fortschritt wird in deinem Browser gespeichert. Falls eine ID angegeben wird, wird diese als Schlüssel verwendet. Wenn keine ID angegeben wird, wird der Inhalt gehasht und eine ID generiert.

## Ressourcen und Videos

- Jeder Knoten kann Ressourcen und einen Videolink für weiteres Lernen enthalten.

## Debug-Knoten

Du kannst einen Debug-Knoten anzeigen, indem du beim Betrachten der Lernkarte **Strg + Leertaste** drückst.

- Der Debug-Knoten zeigt die Position (`x`, `y`), Breite und Höhe aller Knoten auf der Karte.
- Dies ist besonders nützlich, wenn du ein benutzerdefiniertes Hintergrundbild erstellen möchtest, das zum Layout deiner Lernkarte passt.
