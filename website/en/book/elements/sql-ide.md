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
