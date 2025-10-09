---
name: Lernkarte
permaid: lernkarte
---

# Lernkarte

Das `learningmap`-Element ermöglicht es dir, interaktive Lernpfade direkt in deine Markdown-Dateien einzubetten. Du musst dafür **kein** HTML schreiben.

## Grundlegende Verwendung

Um eine Lernkarte hinzuzufügen, verwende folgenden Markdown-Block:

````markdown
::learningmap{id="learningmap-example" height="600px" src="test.learningmap.json"}
````

::learningmap{id="learningmap-example" height="600px" src="test.learningmap.json"}

## Attribute

- `id` (erforderlich): Eine eindeutige Kennung für die Lernkarten-Instanz.
- `height` (optional): Die Höhe des Lernkarten-Containers (z.B. `600px`, `100%`).
- `src` (erforderlich): Der Pfad zur JSON-Datei, die die Struktur der Lernkarte definiert.

## Editor

Du solltest den Learningmap-Editor verwenden, um deine Lernkarten zu erstellen und zu verwalten. Der Editor bietet eine benutzerfreundliche Oberfläche, um Lernpfade zu gestalten und sie als JSON-Dateien zu exportieren.

[Learningmap Editor öffnen](https://learningmap.openpatch.org/editor)
