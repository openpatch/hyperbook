---
name: SQL IDE
---

Java-like programming language (compiler, interpreter, debugger) with IDE that
runs entirely in the browser.

The Online-IDE element accepts three arguments:

- **db**: An url to a sqlite file.
- **height**: Height of the editor. Defaults to 600px.

(See: https://github.com/martin-pabst/SQL-IDE).

:::sqlide{height=500}

```mysql Statements.sql

SELECT * from fluss;

```

:::

````markdown
:::sqlide{height=500}

```mysql Statements.sql

SELECT * from fluss;

```

:::
````
