---
name: Table
permaid: table
next:
---

# Table

You can declare tables by using a combination of pipe symbols (|), for defining
columns and three dashed for defining the header row.

Here is a simple example:

```md
| Name | Value |
| ---- | ----- |
| Red  | 5     |
| Blue | 4     |
```

| Name | Value |
| ---- | ----- |
| Red  | 5     |
| Blue | 4     |

The pipe symboles do not need to be aligned.

## Alignment

The alignment of columns can be declared by using colons.

```md
| Left   | Center | Right |
| :----- | :----: | ----: |
| Text 1 |  Red   |  1600 |
| Text 2 |  Blue  |    12 |
| Text 3 | Green  |     1 |
```

| Left   | Center | Right |
| :----- | :----: | ----: |
| Text 1 |  Red   |  1600 |
| Text 2 |  Blue  |    12 |
| Text 3 | Green  |     1 |

:::alert{info}
The width of a column can not be declared. It will be calculated depending on the content and the webbrowser.
:::
