---
name: Passwordlist
permaid: passwordlist
keywords:
  - password
---

# Passwordlist

Lists the passwords a Hyperbook uses, and where each one is used. It is meant
for a teacher's overview page: one place that answers "which password opens
that section again?".

```md
::passwordlist
```

::::alert{warn}
This directive prints passwords into the built page. Anyone who can open the
page can read every password it lists.

Put it on a page you do not publish, or wrap it in a
[protect](/elements/protect) block with a password only you know:

```md
:::protect{use="teachers"}

::passwordlist

:::
```
::::

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `scope` | `all`, `section` (the section of the current page) or `page` (the current page) | `all` |
| `type` | Which kinds of entry to show: `registry`, `section`, `page`, `block`. Comma-separated | `all` |
| `source` | A query, in the same language as [pagelist](/elements/pagelist) | - |
| `format` | `table`, `ul`, `ol`, or `#snippet` to render a [snippet](/elements/snippets) | `table` |
| `orderBy` | Field and direction, e.g. `key:asc` | `key:asc` |
| `limit` | Show at most this many | - |

## Scope

`scope` filters relative to the page the directive is on.

```md
::passwordlist{scope="section"}
```

Lists only the passwords used inside the current section — useful on a
section's `index.md`.

```md
::passwordlist{scope="page"}
```

Lists only what the current page itself uses.

## Patterns

`source` takes the same query language as [pagelist](/elements/pagelist), so
you can select by path, name or description:

```md
::passwordlist{source="href(/chapter-3.*)"}
```

```md
::passwordlist{source="href(/exercises.*) AND NOT description(draft)"}
```

## Types

Every password is reported where it is used, and once more for the registry
entry itself. Narrow that down with `type`:

```md
::passwordlist{type="registry"}
```

```md
::passwordlist{type="page,section"}
```

## Snippets

With `format="#name"` the list is rendered through a
[snippet](/elements/snippets), which receives `passwords`:

```hbs
{{#each passwords}}
- **{{ password }}** — {{ description }} ({{ where }})
{{/each}}
```

Each entry has `key`, `password`, `description`, `name`, `type`, `href`,
`file`, `line`, `inherited` and `where` (a link to the page, or the file it
came from).

## From the command line

`hyperbook passwords` prints the same information in your terminal, without
putting it in the built book. See [passwords](/configuration/passwords).
