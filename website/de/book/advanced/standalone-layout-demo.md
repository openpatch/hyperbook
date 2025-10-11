---
name: Standalone Layout Demo
layout: standalone
hide: true
lang: de
---

# Standalone Layout Demo

Diese Seite demonstriert das **Standalone Layout** Feature, welches nur den Inhalt ohne Navigation, Header oder Footer-Elemente anzeigt.

## Zweck

Das Standalone Layout ist speziell für die **iframe-Einbettung** konzipiert und ermöglicht die nahtlose Integration von Hyperbook-Seiten in andere Websites oder Anwendungen.

## Hauptmerkmale

- **Nur Inhalt**: Keine Header, Seitenleiste, Navigation oder Footer-Elemente
- **Klare Darstellung**: Perfekt für die Einbettung in externe Seiten
- **Voller Fokus**: Leser sehen nur den Inhalt ohne Ablenkungen
- **Einfache Integration**: Funktioniert nahtlos in iframes

## Verwendung

### Methode 1: Seiten-Frontmatter

Setzen Sie das Layout im Frontmatter Ihrer Seite:

```md
---
name: Meine Standalone-Seite
layout: standalone
---

# Ihr Inhalt hier
```

### Methode 2: URL-Parameter (Empfohlen für iframes)

Fügen Sie `?standalone=true` zu jeder Seiten-URL hinzu:

```html
<iframe src="https://ihr-hyperbook.com/ihre-seite?standalone=true"></iframe>
```

Diese Methode ermöglicht es, **jede Seite** im Standalone-Modus anzuzeigen, ohne deren Frontmatter zu ändern.

## Beispielverwendung

```html
<!-- Diese Seite im Standalone-Modus einbetten -->
<iframe 
  src="/de/advanced/standalone-layout-demo?standalone=true" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

## Anwendungsfälle

- **Lernmanagementsysteme**: Lektionen direkt in LMS-Plattformen einbetten
- **Dokumentationsportale**: Spezifische Seiten in größere Dokumentationsseiten einbinden
- **Präsentationen**: Inhalt in Präsentationstools anzeigen
- **Mobile Apps**: Webinhalte in eingebetteten Webviews zeigen
- **Widget-Integration**: Hyperbook-Inhalte als Widgets einbinden

## Was ist im Standalone-Modus versteckt?

Wenn das Standalone Layout aktiv ist, werden folgende Elemente ausgeblendet:

- Header mit Logo und Navigation
- Seitenleisten-Navigation
- Vorherige/Nächste-Seite-Buttons
- Footer-Metadaten und Links
- Suchfunktion
- Dark Mode Toggle

Nur der Hauptartikel-Inhalt bleibt sichtbar.

## Test

Betrachten Sie diese Seite mit dem URL-Parameter, um den Standalone-Modus zu sehen:
[Diese Seite mit ?standalone=true](/de/advanced/standalone-layout-demo?standalone=true)
