---
name: Seitenverzeichnis
lang: de
---

# Seitenverzeichnis

Das ::pagelist-Element ermöglicht es, ein dynamisches Seitenverzeichnis zu erstellen, das eine Liste von Seiten auf einer Webseite anzeigt. Dabei können verschiedene Optionen verwendet werden, um die angezeigten Seiten zu filtern, das Format der Liste zu wählen und die Reihenfolge zu bestimmen.

```md
::pagelist{format="<Format>" source="<Source>" orderBy="<Sortierkriterium>"}
```

## Parameter

### format

Definiert, wie die Liste dargestellt wird:

- `ol`: Erzeugt eine geordnete Liste
- `ul`: Erzeugt eine ungeordnete Liste
- `glossary`: Erzeugt eine gruppierte Liste nach Anfangsbuchstaben
- `#<snippet>`: Nutzt ein eigenes Snippet zum Erstellen der Liste. Das Snippet erhält `pages` mit allen gefilterten Seiten.

### source

Ein Abfrageausdruck zum Filtern von Seiten. Unterstützt:

**Felder:**
- `href(regex)`: Filtert nach der Seiten-URL
- `name(regex)`: Filtert nach dem Seitennamen
- `keyword(regex)`: Filtert nach Schlüsselwörtern der Seite
- `description(regex)`: Filtert nach der Seitenbeschreibung
- `<customField>(regex)`: Filtert nach beliebigen Frontmatter-Feldern

**Operatoren:**
- `AND`: Beide Bedingungen müssen zutreffen
- `OR`: Eine der Bedingungen muss zutreffen
- `NOT`: Negiert eine Bedingung
- `()`: Gruppiert Bedingungen zur Steuerung der Priorität

Operator-Priorität (höchste zuerst): `NOT` > `AND` > `OR`

### orderBy

Sortiert die Ergebnisse nach einem beliebigen Feld. Format: `feld:richtung`

**Eingebaute Felder:**
- `name`: Sortiert nach dem Seitennamen
- `index`: Sortiert nach dem Seitenindex
- `href`: Sortiert nach der URL

**Eigene Felder:**
- Jedes Frontmatter-Feld kann verwendet werden (z.B. `difficulty:asc`, `priority:desc`)

**Richtungen:**
- `asc`: Aufsteigend
- `desc`: Absteigend (Standard)

Seiten mit fehlenden oder null-Werten für das Sortierfeld werden ans Ende sortiert.

### limit

Begrenzt die Anzahl der zurückgegebenen Ergebnisse.

```md
::pagelist{source="href(/elements/.*)" limit="5"}
```

## Beispiele für die Abfragesprache

### Einfache Abfragen

```md
::pagelist{source="href(/elements/.*)"}
::pagelist{source="name(.*IDE.*)"}
::pagelist{source="keyword(tutorial)"}
```

### AND - Beide Bedingungen müssen zutreffen

```md
::pagelist{source="href(/elements/.*) AND keyword(media)"}
::pagelist{source="name(.*IDE.*) AND href(.*sql.*)"}
```

### OR - Eine der Bedingungen trifft zu

```md
::pagelist{source="name(Video) OR name(Audio)"}
::pagelist{source="keyword(beginner) OR keyword(tutorial)"}
```

### NOT - Passende Seiten ausschließen

```md
::pagelist{source="href(/elements/.*) AND NOT name(Video)"}
::pagelist{source="NOT keyword(deprecated)"}
```

### Klammern - Bedingungen gruppieren

```md
::pagelist{source="href(/elements/.*) AND (name(Video) OR name(Audio))"}
::pagelist{source="(href(/elements/.*) OR href(/advanced/.*)) AND keyword(test)"}
```

### Eigene Frontmatter-Felder

Wenn deine Seiten eigene Frontmatter-Felder haben:

```yaml
---
name: Meine Seite
difficulty: beginner
tags:
  - tutorial
  - video
---
```

Kannst du danach filtern:

```md
::pagelist{source="difficulty(beginner)"}
::pagelist{source="tags(tutorial)"}
::pagelist{source="difficulty(beginner) OR difficulty(intermediate)"}
::pagelist{source="tags(video) AND NOT difficulty(advanced)"}
```

## Sortierbeispiele

### Nach Name sortieren

```md
::pagelist{source="href(/elements/.*)" orderBy="name:asc"}
::pagelist{source="href(/elements/.*)" orderBy="name:desc"}
```

### Nach eigenen Frontmatter-Feldern sortieren

```md
::pagelist{source="tags(tutorial)" orderBy="difficulty:asc"}
::pagelist{source="href(/.*)" orderBy="priority:desc"}
```

## Formatbeispiele

### Glossar

```md
::pagelist{format="glossary" source="href(/glossary/.*)"}
```

::pagelist{format="glossary" source="href(/glossary/.*)"}

### Ein Glossar aller Elemente

```md
::pagelist{format="glossary" source="href(/elements/.*)"}
```

::pagelist{format="glossary" source="href(/elements/.*)"}

### Ungeordnete Liste nach dem href

```md
::pagelist{format="ul" source="href(/elements/.*)" orderBy="name:desc"}
```

::pagelist{format="ul" source="href(/elements/.*)" orderBy="name:desc"}

### Geordnete Liste mit IDE im Namen und einmal zusätzlich mit SQL in der URL

```md
::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}
```

::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}

### Mit OR mehrere spezifische Seiten auflisten

```md
::pagelist{format="ul" source="name(Video) OR name(Audio) OR name(YouTube)"}
```

::pagelist{format="ul" source="name(Video) OR name(Audio) OR name(YouTube)"}

### Seiten mit NOT ausschließen

```md
::pagelist{format="ul" source="href(/elements/.*) AND NOT name(.*IDE.*)" orderBy="name:asc" limit="10"}
```

::pagelist{format="ul" source="href(/elements/.*) AND NOT name(.*IDE.*)" orderBy="name:asc" limit="10"}

### Eigenes Snippet

Das Snippet liegt im Ordner `snippets` mit dem Namen `list.md.hbs`

```hbs
{{#each pages}}
- {{{ name }}}: [{{ href }}]({{ href }})
{{/each}}
```

```md
::pagelist{format="#list" source="name(^V.*)"}
```

::pagelist{format="#list" source="name(^V.*)"}

:::alert{warn}
Bei der Verwendung von eigenen Snippets mit pagelist sind die dateibezogenen Helfer **nicht verfügbar**:
- `file`
- `rfile`
- `base64`
- `rbase64`

Alle anderen Helfer (wie `dateformat`, `truncate`, `truncateWords`, usw.) funktionieren normal.
:::
