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
| description | Beschreibung der Seite. Wird für SEO verwendet.                                                                                                |
| keywords    | Eine Liste von Schlüsselwörter. Wird für SEO verwendet.                                                                                        |
| index       | Eine Zahl, die die Position relative zu anderen Seiten auf dieser Navigationsebene angibt. Kleine Zahlen erscheinen zuerst in der Navigation.  |
| prev        | Ein absoluter Pfad zur vorherigen Seite. Dies überschreibt index und hide. Du kannst außerdem nichts setzen, sodass der Button versteckt wird. |
| next        | Ein absoluter Pfad zur nächsten Seite. Dies überschreibt index und hide. Du kannst außerdem nichts setzen, sodass der Button versteckt wird.   |
| hide        | Verstecke die Seite von der Navigation.                                                                                                        |
| toc         | Zeige ein Inhaltsverzeichnis. Diese ist standardmäßig aktiviert für Seiten und deaktiviert für Begriffe im Glossar.                            |
