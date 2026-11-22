---
name: Header
permaid: header
---

# Header

```md
# H1

## H2

### H3

#### H4

##### H5

###### H6
```

# H1

## H2

### H3

#### H4

##### H5

###### H6

:::alert{warn}
Please use the correct hierarchy of headers, because these will be used for generating a table of contents.
:::

## Custom Ids

If you want stable links to your headings, even if the content of the heading changes you can use custom ids:

```md
# Stable H1 {#stable}
```

The id is used as written, so a link to `#stable` still works when the text of the heading changes. Whitespace is replaced by `-`, because an id cannot contain a space.

# Stable H1 {#stable}
