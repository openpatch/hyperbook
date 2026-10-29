---
name: SQL IDE
lang: de
---

Das SQL-IDE Element akzeptiert verschiedene Parameter:

- **db**: Eine URL zu einer SQLite Datei.
- **height**: Höhe des Editors. Standardwert 600px.

(Siehe: https://github.com/martin-pabst/SQL-IDE).

## Dateien laden

Verwenden Sie `::file`-Direktiven innerhalb des `:::sqlide`-Blocks, um Dateien aus Ihrem Projekt in den Editor zu laden. Eine `.sql`-Datei wird ein weiterer Reiter im Editor, eine Markdown-Datei ein Hinweis.

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

Die `::file`-Direktive nimmt zwei Parameter:
- `path`: Der Name, unter dem die Datei im Editor erscheint. Fehlt er, wird der Dateiname von `src` verwendet.
- `src`: Der Quellenpfad zur Datei in Ihrem Projekt (z.B. `daten/setup.sql`).

## Beispiele

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
