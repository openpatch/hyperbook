---
name: Link
lang: de
---

# Link

Es existieren zwei Möglichkeiten Links zu erstellen.

```md
[Link im Text](https://www.openpatch.org)

[Link im Text mit einem Titel](https://www.openpatch.org "Webseite von OpenPatch")

[Referenzlink][ein case-insensitive referenztext]

[Referenzlink mit einer Zahl][1]

URLs und URLs in spitzen Klammern werden automatisch in Links umgewandelt.
http://www.example.com oder <http://www.example.com>.

Referenzlinks können erst später im Text definiert werden.

[ein case-insensitive referenztext]: https://edugit.org
[1]: http://codeberg.org
```

[Link im Text](https://www.openpatch.org)

[Link im Text mit einem Titel](https://www.openpatch.org "Webseite von OpenPatch")

[Referenzlink][ein case-insensitive referenztext]

[Referenzlink mit einer Zahl][1]

URLs und URLs in spitzen Klammern werden automatisch in Links umgewandelt.
http://www.example.com oder <http://www.example.com>.

Referenzlinks können erst später im Text definiert werden.

[ein case-insensitive referenztext]: https://edugit.org
[1]: http://codeberg.org

## Interne Links

Du kannst auf andere Seiten in deinem Buch mit relativen Pfaden verlinken. Hyperbook behandelt Markdown-Dateiendungen automatisch, sodass du Links mit oder ohne `.md`-Endung verwenden kannst:

```md
[Mit Endung](./andere-seite.md)
[Ohne Endung](./andere-seite)
```

Beide Links zeigen auf dieselbe Seite. Dies funktioniert auch für andere Markdown-Dateitypen:

```md
[Vorlagendatei](./vorlage.md.hbs)
[JSON-Datei](./daten.md.json)
[YAML-Datei](./konfig.md.yml)
```
