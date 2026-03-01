---
name: Layouts
index: 8
lang: de
---

# Seiten-Layouts

Hyperbook bietet drei Layout-Optionen für unterschiedliche Anforderungen an die Inhaltsdarstellung. Sie können ein Layout wählen, indem Sie die `layout` Eigenschaft im Frontmatter Ihrer Seite hinzufügen.

## Verfügbare Layouts

### Standard-Layout

Das Standardlayout mit sichtbarer Seitenleiste auf Desktop-Bildschirmen. Dies ist das Standardlayout, wenn kein Layout angegeben wird.

**Merkmale:**
- Seitenleisten-Navigation auf Desktop immer sichtbar
- Inhaltsbereich mit optimaler Lesebreite
- Responsives Design, das auf Mobilgeräten zur Drawer-Navigation wechselt

**Verwendung:**
```md
---
name: Meine Seite
layout: default
---
```

Oder lassen Sie die `layout` Eigenschaft einfach weg.

**Am besten für:** Standard-Dokumentationsseiten, Tutorials und Artikel.

---

### Wide Layout

Inhalt in voller Breite mit Navigation immer im Drawer-Modus, bietet maximalen horizontalen Platz.

**Merkmale:**
- Inhalt erstreckt sich über volle Breite mit Padding
- Seitenleiste auf allen Bildschirmgrößen versteckt
- Navigation über Hamburger-Menü zugänglich
- Ideal für Inhalte, die horizontalen Platz benötigen

**Verwendung:**
```md
---
name: Meine Breite Seite
layout: wide
---
```

**Am besten für:**
- Datentabellen mit vielen Spalten
- Lange Code-Beispiele
- Bildergalerien
- Interaktive eingebettete Inhalte
- Präsentations-Seiten

**[Wide Layout Demo ansehen →](/de/advanced/wide-layout-demo)**

---

### Standalone Layout

Nur-Inhalts-Anzeige mit allen versteckten Navigations- und UI-Elementen, perfekt für iframe-Einbettung.

**Merkmale:**
- Keine Header-, Seitenleisten- oder Footer-Elemente
- Saubere, ablenkungsfreie Inhalte
- Kann über Frontmatter, URL-Parameter oder automatisch in iframes aktiviert werden
- Entwickelt für die Einbettung in externe Seiten
- Versteckt automatisch TOC- und QR-Code-Buttons

**Verwendungsmethode 1: Frontmatter**
```md
---
name: Meine Standalone-Seite
layout: standalone
---
```

**Verwendungsmethode 2: URL-Parameter** (funktioniert auf jeder Seite)
```html
<iframe src="https://ihr-hyperbook.com/beliebige-seite?standalone=true"></iframe>
```

**Verwendungsmethode 2a: Sections-Filter** (spezifische Inhalte filtern)

Sie können den Standalone-Modus mit einem `sections` Parameter kombinieren, um nur bestimmte Abschnitte anhand ihrer Header-IDs anzuzeigen:

```html
<iframe src="https://ihr-hyperbook.com/beliebige-seite?standalone=true&sections=aufgabe-1-ebene-in-koordinatenform"></iframe>
```

Der `sections` Parameter akzeptiert:
- Einzelne Abschnitts-ID: `sections=meine-header-id`
- Mehrere Abschnitte (kommagetrennt): `sections=abschnitt-1,abschnitt-2,abschnitt-3`

Wenn ein Abschnitt angegeben wird, werden nur die Überschrift mit dieser ID und alle Inhalte bis zur nächsten Überschrift der gleichen oder höheren Ebene angezeigt. Überschriften niedrigerer Ebenen (Unterabschnitte) werden automatisch eingeschlossen.

**Header-IDs finden**: Header-IDs werden automatisch aus dem Überschriftentext generiert, indem dieser in Kleinbuchstaben umgewandelt und Leerzeichen durch Bindestriche ersetzt werden. Sonderzeichen werden entfernt. Zum Beispiel:
- `## Mein Abschnittstitel` → `mein-abschnittstitel`
- `### Aufgabe 1: Ebene in Koordinatenform` → `aufgabe-1-ebene-in-koordinatenform`

Sie können auch benutzerdefinierte IDs mit der `{#custom-id}` Syntax in Ihrem Markdown definieren: `## Mein Abschnitt {#benutzerdefinierte-id}`

**Teilen-Button**: Jede Seite enthält einen Teilen-Button (🔗 Symbol) im Header, der einen Dialog öffnet, um einfach teilbare URLs zu erstellen mit:
- Standalone-Modus Umschalter
- Abschnittsauswahl per Checkboxen (Inhaltsverzeichnis-Ansicht)
- Live-URL-Vorschau
- Ein-Klick-Kopieren in die Zwischenablage

**Verwendungsmethode 3: Automatische Erkennung** (iframe-Einbettung)

Wenn eine Hyperbook-Seite in einem iframe eingebettet wird, wechselt sie automatisch in den Standalone-Modus - keine Konfiguration erforderlich! Dies ermöglicht eine nahtlose Einbettung ohne URL-Parameter oder Frontmatter-Änderungen.

```html
<!-- Betten Sie einfach eine beliebige Seite ein - Standalone-Modus wird automatisch aktiviert -->
<iframe src="https://ihr-hyperbook.com/beliebige-seite"></iframe>
```

Die automatische Erkennung sorgt für saubere, ablenkungsfreie Inhalte bei iframe-Einbettungen und behält gleichzeitig die volle Funktionalität bei, wenn Seiten direkt aufgerufen werden.

**Am besten für:**
- Lernmanagementsystem (LMS) Integration
- Einbettung in Dokumentationsportale
- Mobile App Webviews
- Widget-Integration
- Präsentationen

**[Standalone Layout Demo ansehen →](/advanced/standalone-layout-demo)**

**[Sections-Filter Demo ansehen →](/advanced/sections-filter-demo)**

---

## Konfiguration

Die Layout-Eigenschaft ist optional im Frontmatter Ihrer Seite:

```md
---
name: Seitentitel
layout: wide  # oder 'default', 'standalone'
---

# Ihr Inhalt hier
```

## Layout-Vergleich

| Merkmal | Standard | Wide | Standalone |
|---------|---------|------|------------|
| Seitenleisten-Sichtbarkeit | Sichtbar auf Desktop | Immer versteckt | Immer versteckt |
| Inhaltsbreite | Begrenzt für Lesbarkeit | Volle Breite | Volle Breite |
| Navigationszugriff | Seitenleiste / Drawer | Nur Drawer | Keine (versteckt) |
| Header | Sichtbar | Sichtbar | Versteckt |
| Footer | Sichtbar | Sichtbar | Versteckt |
| Bester Anwendungsfall | Dokumentation | Tabellen, Galerien | iframe-Einbettung |

---

## Tipps

- **Standard-Layout**: Verwenden Sie es für die meisten Dokumentationsseiten, um eine konsistente Navigation zu gewährleisten
- **Wide Layout**: Wechseln Sie zu wide, wenn Inhalte horizontalen Platz benötigen (Tabellen, Code, Galerien)
- **Standalone Layout**: Verwenden Sie den URL-Parameter (`?standalone=true`) für flexible iframe-Einbettung ohne Änderung der Seitenquelle
- Sie können verschiedene Layouts über Seiten im selben Hyperbook-Projekt mischen
