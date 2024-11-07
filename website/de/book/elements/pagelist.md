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

- format
  - ol: Erzeugt eine geordnete Liste
  - ul: Erzeugt eine ungeordnete Liste
  - glossary: Erzeugt einen gruppierte Liste
  - #<snippet>: Nutzt das Snippet zum Erstellen der Liste. Dabei bekommt das Snippet `pages` übergeben, welches alle Seiten enthält. Diese können dann verarbeitet werden.
- source
  - href: Der Link der Seite
  - name: Der Name der Seite
  - keyword: Die Keywords der Seite
- orderBy
  - name: Sortiert nach dem Namen der Seite
  - index: Sortiert nach dem Index der Seite
  - href: Sortiert nach der URL
  - asc: Aufsteigend
  - desc: Absteigend

## Beispiel

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
::pagelist{format="ol" source="href(.*SQL.*) AND name(.*IDE.*)"}
```

::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}

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
