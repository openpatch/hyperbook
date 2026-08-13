---
name: Passwortliste
lang: de
permaid: passwordlist
keywords:
  - Passwort
---

# Passwortliste

Zeigt die Passwörter eines Hyperbooks und wo sie verwendet werden. Gedacht ist
das für eine Übersichtsseite für Lehrkräfte: eine Stelle, die beantwortet
"welches Passwort öffnet noch mal diesen Abschnitt?".

```md
::passwordlist
```

::::alert{warn}
Dieses Element schreibt Passwörter in die gebaute Seite. Wer die Seite öffnen
kann, liest alle aufgeführten Passwörter.

Lege sie auf eine Seite, die du nicht veröffentlichst, oder packe sie in einen
[geschützten Bereich](/elements/protect) mit einem Passwort, das nur du kennst:

```md
:::protect{use="lehrkraefte"}

::passwordlist

:::
```
::::

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `scope` | `all`, `section` (Abschnitt der aktuellen Seite) oder `page` (aktuelle Seite) | `all` |
| `type` | Welche Einträge: `registry`, `section`, `page`, `block`. Mit Komma getrennt | `all` |
| `source` | Eine Abfrage in derselben Sprache wie bei [pagelist](/elements/pagelist) | - |
| `format` | `table`, `ul`, `ol` oder `#snippet` für ein [Snippet](/elements/snippets) | `table` |
| `orderBy` | Feld und Richtung, z. B. `key:asc` | `key:asc` |
| `limit` | Höchstens so viele anzeigen | - |

## Bereich

`scope` filtert relativ zu der Seite, auf der das Element steht.

```md
::passwordlist{scope="section"}
```

Zeigt nur die Passwörter, die im aktuellen Abschnitt verwendet werden —
praktisch in der `index.md` eines Abschnitts.

```md
::passwordlist{scope="page"}
```

Zeigt nur, was die aktuelle Seite selbst verwendet.

## Muster

`source` verwendet dieselbe Abfragesprache wie [pagelist](/elements/pagelist).
Du kannst also nach Pfad, Name oder Beschreibung auswählen:

```md
::passwordlist{source="href(/kapitel-3.*)"}
```

```md
::passwordlist{source="href(/aufgaben.*) AND NOT description(Entwurf)"}
```

## Typen

Jedes Passwort erscheint dort, wo es verwendet wird, und zusätzlich einmal als
Eintrag der Passwortliste. Mit `type` schränkst du das ein:

```md
::passwordlist{type="registry"}
```

```md
::passwordlist{type="page,section"}
```

## Snippets

Mit `format="#name"` wird die Liste über ein [Snippet](/elements/snippets)
ausgegeben, das `passwords` bekommt:

```hbs
{{#each passwords}}
- **{{ password }}** — {{ description }} ({{ where }})
{{/each}}
```

Jeder Eintrag hat `key`, `password`, `description`, `name`, `type`, `href`,
`file`, `line`, `inherited` und `where` (ein Link zur Seite oder die Datei, aus
der er stammt).

## Auf der Kommandozeile

`hyperbook passwords` gibt dieselben Angaben im Terminal aus, ohne sie in das
gebaute Buch zu schreiben. Siehe [Passwörter](/configuration/passwords).
