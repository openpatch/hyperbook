---
name: Sections-Filter Demo
hide: true
lang: de
---

# Sections-Filter Demo

Diese Seite demonstriert die **Sections-Filter** Funktion, mit der Sie nur bestimmte Abschnitte einer Seite mit dem `sections` Query-Parameter anzeigen können.

## Abschnitt 1: Einführung

Dies ist der erste Abschnitt. Er enthält einführende Inhalte.

### Unterabschnitt 1.1

Dies ist ein Unterabschnitt von Abschnitt 1. Wenn Sie nach der übergeordneten Abschnitts-ID filtern, wird dieser Unterabschnitt ebenfalls eingeschlossen.

### Unterabschnitt 1.2

Ein weiterer Unterabschnitt mit mehr Details.

## Abschnitt 2: Funktionen

Dieser Abschnitt beschreibt die Funktionen des Sections-Filters.

### Hauptvorteile

- **Gezielte Inhalte**: Zeigen Sie nur das Relevante
- **Flexible Einbettung**: Kombinieren Sie Abschnitte nach Bedarf
- **Automatische Unterabschnitte**: Überschriften niedrigerer Ebenen werden eingeschlossen

### Verwendungsbeispiele

Sie können diese Funktion auf verschiedene Weise nutzen, um fokussierte Inhaltsansichten zu erstellen.

## Abschnitt 3: Beispiele

Hier sind einige praktische Beispiele.

### Beispiel 1

Erstes Beispiel mit detaillierter Erklärung.

### Beispiel 2

Zweites Beispiel mit einem anderen Anwendungsfall.

## Abschnitt 4: Fazit

Dies ist der letzte Abschnitt mit abschließenden Bemerkungen.

---

## Verwendung

Um bestimmte Abschnitte anzuzeigen, fügen Sie den `sections` Parameter zur URL hinzu:

- Nur Abschnitt 1 anzeigen: `?sections=abschnitt-1-einfuhrung`
- Nur Abschnitt 2 anzeigen: `?sections=abschnitt-2-funktionen`
- Mehrere Abschnitte anzeigen: `?sections=abschnitt-1-einfuhrung,abschnitt-3-beispiele`

### Probieren Sie es aus

- [Nur Abschnitt 1 anzeigen](/de/advanced/sections-filter-demo?standalone=true&sections=abschnitt-1-einfuhrung)
- [Nur Abschnitt 2 anzeigen](/de/advanced/sections-filter-demo?standalone=true&sections=abschnitt-2-funktionen)
- [Abschnitte 1 und 3 anzeigen](/de/advanced/sections-filter-demo?standalone=true&sections=abschnitt-1-einfuhrung,abschnitt-3-beispiele)

### Einbettungsbeispiel

```html
<!-- Nur Abschnitt 2 einbetten -->
<iframe 
  src="/de/advanced/sections-filter-demo?standalone=true&sections=abschnitt-2-funktionen" 
  width="100%" 
  height="400px"
  frameborder="0">
</iframe>
```
