---
name: Pagelist
lang: en
permaid: pagelist
---

# Pagelist

The ::pagelist element allows you to create a dynamic page directory that displays a list of pages on a website. Various options can be used to filter the displayed pages, choose the format of the list, and determine the order.

```md
::pagelist{format="<Format>" source="<Source>" orderBy="<OrderCriteria>"}
```

## Parameters

### format

Defines how the list is rendered:

- `ol`: Creates an ordered list
- `ul`: Creates an unordered list
- `glossary`: Creates a grouped list by first letter
- `#<snippet>`: Uses a custom snippet to generate the list. The snippet receives `pages` containing all filtered pages.

### source

A query expression to filter pages. Supports:

**Fields:**
- `href(regex)`: Match the page URL
- `name(regex)`: Match the page name
- `keyword(regex)`: Match any of the page's keywords
- `description(regex)`: Match the page description
- `isEmpty(true|false)`: Check if the page has no content
- `<customField>(regex)`: Match any custom frontmatter field

**Operators:**
- `AND`: Both conditions must match
- `OR`: Either condition must match
- `NOT`: Negate a condition
- `()`: Group conditions to control precedence

Operator precedence (highest to lowest): `NOT` > `AND` > `OR`

### orderBy

Sort the results by any field. Format: `field:direction`

**Built-in fields:**
- `name`: Sort by page name
- `index`: Sort by page index
- `href`: Sort by page URL

**Custom fields:**
- Any frontmatter field can be used (e.g., `difficulty:asc`, `priority:desc`)

**Directions:**
- `asc`: Ascending order
- `desc`: Descending order (default)

Pages with missing or null values for the sort field are placed at the end.

### limit

Limit the number of results returned.

```md
::pagelist{source="href(/elements/.*)" limit="5"}
```

## Query Language Examples

### Basic Queries

```md
::pagelist{source="href(/elements/.*)"}
::pagelist{source="name(.*IDE.*)"}
::pagelist{source="keyword(tutorial)"}
```

### AND - Both conditions must match

```md
::pagelist{source="href(/elements/.*) AND keyword(media)"}
::pagelist{source="name(.*IDE.*) AND href(.*sql.*)"}
```

### OR - Either condition matches

```md
::pagelist{source="name(Video) OR name(Audio)"}
::pagelist{source="keyword(beginner) OR keyword(tutorial)"}
```

### NOT - Exclude matching pages

```md
::pagelist{source="href(/elements/.*) AND NOT name(Video)"}
::pagelist{source="NOT keyword(deprecated)"}
```

### Parentheses - Group conditions

```md
::pagelist{source="href(/elements/.*) AND (name(Video) OR name(Audio))"}
::pagelist{source="(href(/elements/.*) OR href(/advanced/.*)) AND keyword(test)"}
```

### Custom Frontmatter

If your pages have custom frontmatter fields:

```yaml
---
name: My Page
difficulty: beginner
tags:
  - tutorial
  - video
---
```

You can query them:

```md
::pagelist{source="difficulty(beginner)"}
::pagelist{source="tags(tutorial)"}
::pagelist{source="difficulty(beginner) OR difficulty(intermediate)"}
::pagelist{source="tags(video) AND NOT difficulty(advanced)"}
```

## Sorting Examples

### Sort by name

```md
::pagelist{source="href(/elements/.*)" orderBy="name:asc"}
::pagelist{source="href(/elements/.*)" orderBy="name:desc"}
```

### Sort by custom frontmatter

```md
::pagelist{source="tags(tutorial)" orderBy="difficulty:asc"}
::pagelist{source="href(/.*)" orderBy="priority:desc"}
```

## Format Examples

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

### Ordered List with IDE in the name and additionally with SQL in the URL

```md
::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}
```

::pagelist{format="ol" source="name(.*IDE.*)"}
::pagelist{format="ol" source="href(.*sql.*) AND name(.*IDE.*)"}

### Using OR to list multiple specific pages

```md
::pagelist{format="ul" source="name(Video) OR name(Audio) OR name(YouTube)"}
```

::pagelist{format="ul" source="name(Video) OR name(Audio) OR name(YouTube)"}

### Excluding pages with NOT

```md
::pagelist{format="ul" source="href(/elements/.*) AND NOT name(.*IDE.*)" orderBy="name:asc" limit="10"}
```

::pagelist{format="ul" source="href(/elements/.*) AND NOT name(.*IDE.*)" orderBy="name:asc" limit="10"}

### Custom snippet

The snippet is located in the `snippets` folder with the name `list.md.hbs`

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
When using custom snippets with pagelist, the file-related helpers are **not available**:
- `file`
- `rfile`
- `base64`
- `rbase64`

All other helpers (like `dateformat`, `truncate`, `truncateWords`, etc.) work normally.
:::
