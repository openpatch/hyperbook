---
name: Seiten Konfiguration
lang: de
index: 1
---

# Seiten Konfiguration

Eine Seite ist eine Markdown-Datei, welche ein Frontmatter und einen Inhalt besitzt.

Das Frontmatter gibt Hyperbook zusätzliche Information zum Arbeiten. Das Frontmatter befindet sich am Anfang der Markdown-Datei und ist umschlossen von drei Bindestrichen `---`.

```md
---
name: Name der Seite
description: Eine tolle Seite, die viele Information enthält
keyword:
  - Information
  - Hyperbook
index: 1
hide: false
toc: true
prev:
next: /elements/audio
---

# Eine Überschrift

Der Inhalt
```

Hier sind die Eigenschaften, die im Frontmatter gesetzt werden können:

| Eigenschaft | Beschreibung                                                                                                                                   |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| name        | Name der Seite. Wird in der Navigation verwendet.                                                                                              |
| title       | Alternative zu `name` für Kompatibilität mit anderen Tools wie MkDocs. Wenn beide gesetzt sind, hat `name` Vorrang                            |
| description | Beschreibung der Seite. Wird für SEO verwendet.                                                                                                |
| permaid     | Eine id, welche die Seite auch unter zum Beispiel /@/audio verfügbar macht, wenn die permaid auf audio gesetzt wurde. |
| keywords    | Eine Liste von Schlüsselwörter. Wird für SEO verwendet.                                                                                        |
| index       | Eine Zahl, die die Position relative zu anderen Seiten auf dieser Navigationsebene angibt. Kleine Zahlen erscheinen zuerst in der Navigation.  |
| prev        | Ein absoluter Pfad zur vorherigen Seite or ein absoluter Pfad zur permaid z. B. /@/audio. Dies überschreibt index und hide. Du kannst außerdem nichts setzen, sodass der Button versteckt wird. |
| next        | Ein absoluter Pfad zur nächsten Seite or ein absoluter Pfad zur permaid z. B. /@/audio. Dies überschreibt index und hide. Du kannst außerdem nichts setzen, sodass der Button versteckt wird.   |
| hide        | Verstecke die Seite von der Navigation. (veraltet, verwende stattdessen `navigation: hidden`)                                                  |
| navigation  | Steuert wie die Seite in der Navigation angezeigt wird. Optionen: `default` (normale Anzeige), `hidden` (versteckt in der Navigation)          |
| toc         | Zeige ein Inhaltsverzeichnis. Diese ist standardmäßig aktiviert für Seiten und deaktiviert für Begriffe im Glossar.                            |
| layout      | Wähle das Seitenlayout. Optionen: `default` (Standardlayout mit Seitenleiste), `wide` (Inhalt in voller Breite mit Navigation im Drawer-Modus) oder `standalone` (nur Inhalt, versteckt alle Navigation - ideal für iframe-Einbettung). Das standalone Layout kann auch über URL-Parameter aktiviert werden: `?standalone=true` |
| qrcode | Zeigt ein Icon, um einen QR-Code zur Seite anzuzeigen |
| styles            | Hier können Links zu eigenen CSS-Styles gesetzt werden. |
| scripts            | Hier können Links zu eigenen JavaScript-Dateien gesetzt werden. |
