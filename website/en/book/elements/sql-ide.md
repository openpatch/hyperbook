---
name: SQL IDE
permaid: sql-ide
---

# SQL IDE

The `sqlide` directive embeds an SQL editor and runner for SQLite databases directly in your book.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `db` | URL or path to the SQLite database file | bundled demo database |
| `height` | Height of the editor | `calc(100dvh - 80px)` |

(See: https://github.com/martin-pabst/SQL-IDE).

## Load files

Use `::file` directives inside the `:::sqlide` block to add files from your project to the editor. A `.sql` file becomes another editor tab, a Markdown file a hint.

:::sqlide

```mysql Statements.sql

SELECT * from fluss;

```

::file{path="setup.sql" src="/setup.sql"}

:::

````markdown
:::sqlide

```mysql Statements.sql

SELECT * from fluss;

```

::file{path="setup.sql" src="/setup.sql"}

:::
````

The `::file` directive takes two parameters:
- `path`: The name under which the file shows up in the editor. If left out, the file name of `src` is used.
- `src`: The source path to the file in your project (e.g., `data/setup.sql`).

## Examples

:::sqlide{height="500px"}

```mysql Statements.sql

SELECT * from fluss;

```

:::

````markdown
:::sqlide{height="500px"}

```mysql Statements.sql

SELECT * from fluss;

```

:::
````
