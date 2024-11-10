---
name: Pagelist
lang: en
permaid: pagelist
---

# Pagelist

The ::pagelist element allows you to create a dynamic page directory that displays a list of pages on a website. Various options can be used to filter the displayed pages, choose the format of the list, and determine the order.

```md
::pagelist{format="<Format>" source="<Source>" orderBy="<Sortierkriterium>"}
```

## Parameter

- format
  - ol: Creates an ordered list
  - ul: Creates an unordered list
  - glossary: Creates a grouped list
  - #<snippet>: Uses the snippet to generate the list. The snippet receives pages, which contains all pages, and can then process them.
- source
  - href: The page link
  - name: The page name
  - keyword: The page keywords
- orderBy
  - name: Sorts by the page name
  - index: Sorts by the page index
  - href: Sorts by the URL
  - asc: Ascending
  - desc: Descending

## Examples

### Glossary

```md
::pagelist{format="glossary" source="href(/glossary/.*)"}
```

::pagelist{format="glossary" source="href(/glossary/.*)"}

### A Glossary of all Elements

```md
::pagelist{format="glossary" source="href(/elements/.*)"}
```

::pagelist{format="glossary" source="href(/elements/.*)"}

### Unordered List by href

```md
::pagelist{format="ul" source="href(/elements/.*)" orderBy="name:desc"}
```

::pagelist{format="ul" source="href(/elements/.*)" orderBy="name:desc"}

### Ordered List with IDE in the namen and additionally with SQL in the URL

```md
::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*SQL.*) AND name(.*IDE.*)"}
```

::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}

### Custom snippet

The snippet is located in the `snippets` folger with the name `list.md.hbs`
```hbs
{{#each pages}}
- {{{ name }}}: [{{ href }}]({{ href }})
{{/each}}
```

```md
::pagelist{format="#list" source="name(^V.*)"}
```

::pagelist{format="#list" source="name(^V.*)"}
