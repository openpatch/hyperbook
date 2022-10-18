---
name: Buch Konfiguration
index: 0
lang: de
---

# Buch Konfiguration

In deinem neuen Hyperbook-Projekt findest du eine `hyperbook.json` Datei. Diese
Datei wird verwendet, um dein Hyperbook zu konfigurieren. Hier ist eine Liste
von Optionen, die du definieren kannst. Optionen mit einem "\*" müssen gesetzt werden.

| Property         | Description                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| name\*           | Name des Hyperbooks. Wird für den Seitentitel verwendet.                                                                                                     |
| description      | Beschreibung des Hyperbooks. Wird für SEO verwendet.                                                                                                         |
| logo             | URL eines Logos. Wird für den Seitentitel verwendet. Diese kann relative zum public-Ordner (z.B.: /mein-logo.png) sein oder ein externes Bild referenzieren. |
| author.name      | Name des Autors des Hyperbooks. Wird in der Fußzeile verwendet.                                                                                              |
| author.url       | URL zur Homepage des Autors. Wird in der Fußzeile verwendet.                                                                                                 |
| font             | URL zu einer Schriftart. Wird für Überschriften und normalen Text verwendet.                                                                                 |
| fonts.heading    | URL zu einer Schriftart. Wird für Überschriften verwendet.                                                                                                   |
| fonts.body       | URL zu einer Schriftart. Wird für normalen Text verwendet.                                                                                                   |
| fonts.code       | URL zu einer Schriftart. Wird für Quelltexte verwendet.                                                                                                      |
| colors.brand     | Die Farbe der Kopfzeile und von Akzenten z.B. von Links.                                                                                                     |
| colors.brandDark | Die Farbe der Akzente z.B. von Links. Nur relevant für das dunkle Design. Brand text wird im dunklen Design nicht verwendet.                                 |
| colors.brandText | Die Farbe für den Text in der Kopfzeile.                                                                                                                     |
| basePath         | Wenn das Hyperbook aus einem Unterordner bereitgestellt werden soll, muss dieser hier angegeben werden.                                                      |
| license          | Lizenz unter der das Hyperbook veröffentlicht ist.                                                                                                           |
| language         | Die Sprach des Hyperbooks.                                                                                                                                   |
| repo             | Der Link zum Repository. Wird für das Zeigen eines Edit-Buttons verwendet.                                                                                   |
| elements         | Hier können einzelne Elemente konfiguriert werden. Schaue dazu auf die Elementseiten.                                                                        |
| links            | Hier können Links hinzugefügt werden, welche in der rechten oberen Ecke angezeigt werden. Schaue dir dazu das untere Beispiel an.                            |

Hier ist eine Beispielkonfiguration:

```json
{
  "name": "Hyperbook Documentation",
  "description": "Documentation for Hyperbook created with Hyperbook",
  "author": {
    "name": "OpenPatch",
    "url": "https://openpatch.org"
  },
  "font": "/fonts/my-font.woff2",
  "logo": "/logo.png",
  "license": "CC-BY-SA",
  "language": "en",
  "basePath": "/hyperbook-github-pages",
  "repo": "https://github.com/mikebarkmin/hyperbook-github-pages/edit/main",
  "colors": {
    "brand": "#FF0000"
  },
  "elements": {
    "bookmarks": false
  },
  "links": [
    {
      "label": "Contact",
      "links": [
        {
          "label": "Mail",
          "icon": "📧",
          "href": "mailto:contact@openpatch.org"
        },
        {
          "label": "Twitter",
          "icon": "🐦",
          "href": "https://twitter.com/openpatchorg"
        },
        {
          "label": "Mastodon",
          "icon": "🐘",
          "href": "https://fosstodon.org/@openpatch"
        },
        {
          "label": "Matrix (Chat)",
          "icon": "👨‍💻",
          "href": "https://matrix.to/#/#hyperbook:matrix.org"
        }
      ]
    },
    {
      "label": "OpenPatch",
      "href": "https://openpatch.org"
    }
  ]
}
```
