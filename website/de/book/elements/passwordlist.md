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

| Attribut      | Beschreibung                                                                                                                                                   | Standard                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `scope`       | `all`, `section` (Abschnitt der aktuellen Seite) oder `page` (aktuelle Seite)                                                                                  | `all`                        |
| `type`        | Welche Einträge: `registry`, `section`, `page`, `block`. Mit Komma getrennt                                                                                    | `all`                        |
| `source`      | Eine Abfrage in derselben Sprache wie bei [pagelist](/elements/pagelist)                                                                                       | -                            |
| `format`      | `table`, `ul`, `ol` oder `#snippet` für ein [Snippet](/elements/snippets)                                                                                      | `table`                      |
| `orderBy`     | Feld und Richtung, z. B. `key:asc`                                                                                                                             | `key:asc`                    |
| `limit`       | Höchstens so viele anzeigen                                                                                                                                    | -                            |
| `groupBy`     | Kommagetrennte Ebenen: `section`, `top-section`, `page` oder Eintragsfelder wie `type`, `key`, `context`, `name`, `description`, `password`, `href` und `file` | -                            |
| `collapsible` | Gruppen für diese Ebenen einklappen (`collapsible` = 1, `collapsible="2"` = zwei Ebenen, `collapsible="all"` = alle Ebenen)                                    | -                            |
| `showCount`   | Anzahl der Einträge im Gruppentitel anzeigen                                                                                                                   | -                            |
| `columns`     | Kommagetrennte Spalten: `context`, `password`, `where` oder `description`                                                                                      | `password,where,description` |

## Eine erzeugte Lösungsseite

Geschützte Blöcke erhalten ihren Kontext aus dem Attribut `name`, aus dem Titel
des letzten Aufgaben-Snippets oder aus der letzten Überschrift ab Ebene
zwei. Eine handgepflegte Lösungsseite kann deshalb aus einem Element bestehen:

```md
::passwordlist{type="block" orderBy="navigation" groupBy="top-section,page" collapsible showCount columns="context,password"}
```

Die Gruppierung wird von links nach rechts angewendet (Kommas und `/` sind als
Trennzeichen möglich). `section` folgt der
gesamten Navigationshierarchie und erzeugt dadurch automatisch verschachtelte
Gruppen; mit `section,page` (oder `section/section/page`) werden Abschnitte,
Unterabschnitte und danach ihre Seiten gruppiert. `top-section` ist die Kurzform,
die nur nach dem äußersten
Abschnitt gruppiert. Für eine Registry-Ansicht kann zum Beispiel nach Typ und
Schlüssel gruppiert werden:

```md
::passwordlist{groupBy="type,key" showCount}
```

Einträge ohne Wert landen in einer Gruppe `Sonstige`. Der Titel einer
`page`-Gruppe verlinkt auf die Seite, sofern es eine gibt. Gruppierung
funktioniert mit Tabellen und Listen; Snippets erhalten weiterhin die flache,
gefilterte Eintragsliste.

Bei ungewöhnlich aufgebauten Seiten kann die Bezeichnung ausdrücklich am
Block stehen:

```md
:::protect{password="kapitel-2-1" name="Aufgabe 1: Zwei Wege"}
...
:::
```

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
  - **{{password}}** —
  {{description}}
  ({{where}})
{{/each}}
```

Jeder Eintrag hat `key`, `password`, `description`, `name`, `type`, `href`,
`file`, `line`, `inherited` und `where` (ein Link zur Seite oder die Datei, aus
der er stammt).

## Auf der Kommandozeile

`hyperbook passwords` gibt dieselben Angaben im Terminal aus, ohne sie in das
gebaute Buch zu schreiben. Siehe [Passwörter](/configuration/passwords).
