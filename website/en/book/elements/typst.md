---
name: Typst
permaid: typst
---

# Typst

The Typst directive allows you to render [Typst](https://typst.app/) documents directly in your hyperbook. Typst is a modern markup-based typesetting system that is easy to learn and produces beautiful documents.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `id` | Unique identifier for the Typst block | Auto-generated |
| `mode` | Display mode: `preview` (view only) or `edit` (with editor) | `preview` |
| `height` | Height of the preview container | `auto` |

## Important Notes

- **Multiple Typst Blocks**: When multiple Typst blocks are present on the same page, they render sequentially (one at a time) to ensure file isolation. Each block maintains its own independent file system during rendering.
- **File Isolation**: Files loaded in one Typst block (via `@source` or `@file`) are completely isolated from other blocks on the same page. This means you can use the same filename (e.g., `other.typ`) in different blocks without conflicts.


## Usage

To use the Typst directive, wrap your Typst code in a `:::typst` block with a code block using the `typ` or `typst` language.

### Preview Mode

In preview mode, only the rendered output is shown with a download button for exporting to PDF.

````md
:::typst{mode="preview"}

```typ
= Hello World!

This is a simple Typst document.

- First item
- Second item
- Third item
```

:::
````

:::typst{mode="preview"}

```typ
= Hello World!

This is a simple Typst document.

- First item
- Second item
- Third item
```

:::

### Edit Mode

In edit mode, an editor is shown alongside the preview, allowing users to modify the Typst code and see live updates.

````md
:::typst{mode="edit"}

```typ
= Interactive Document

You can edit this text and see the changes live!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::
````

:::typst{mode="edit"}

```typ
= Interactive Document

You can edit this text and see the changes live!

$ sum_(i=1)^n i = (n(n+1))/2 $
```

:::

### Loading from External Files

You can load Typst source files and binary files (like images) from external sources using special directives.

#### Loading Source Files

Use the `@source` directive to load Typst source files that can be included in your main document:

````md
:::typst{mode="preview"}

@source dest="other.typ" src="typst-doc.typ"

```typ
= Main Document

#include "/other.typ"
```
:::
````

:::typst{mode="preview"}

@source dest="other.typ" src="typst-doc.typ"

```typ
= Main Document

#include "/other.typ"
```
:::

#### Loading Binary Files

Use the `@file` directive to load binary files like images:

````md
:::typst{mode="preview"}

@file dest="/image.jpg" src="/my-image.jpg"

```typ
= Document with Image

#figure(
  image("/image.jpg", width: 80%),
  caption: "My image"
)
```
:::
````

#### File Search Locations

Files referenced in `src` attributes are searched in the following locations (in order):
1. `public/` directory
2. `book/` directory  
3. Current page's directory

#### Multiple Source Files

You can define multiple source files by using named code blocks:

````md
:::typst{mode="preview"}

```typ main.typ
= Main Document

#include "/helper.typ"
```

```typ helper.typ
= Helper Content

This content is in a separate file.
```
:::
````

## Examples

### Mathematical Formulas

````md
:::typst{mode="preview" height="300px"}

```typ
= Mathematical Formulas

Typst supports beautiful mathematical typesetting:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

The quadratic formula:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```
:::
````

:::typst{mode="preview" height="300px"}

```typ
= Mathematical Formulas

Typst supports beautiful mathematical typesetting:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

The quadratic formula:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```
:::

### Tables

````md
:::typst{mode="preview" height="250px"}
```typ
= Data Table

#table(
  columns: (auto, auto, auto),
  [*Name*], [*Age*], [*City*],
  [Alice], [25], [Berlin],
  [Bob], [30], [Munich],
  [Carol], [28], [Hamburg],
)
```
:::
````

:::typst{mode="preview" height="250px"}
```typ
= Data Table

#table(
  columns: (auto, auto, auto),
  [*Name*], [*Age*], [*City*],
  [Alice], [25], [Berlin],
  [Bob], [30], [Munich],
  [Carol], [28], [Hamburg],
)
```
:::

### Complex Example with Multiple Files

This example demonstrates loading both source and binary files, with multiple named Typst files:

````md
:::typst{mode="preview" height="250px"}

@file dest="/hello.jpg" src="/test.jpg"

```typ main.typ
= Code Example

Here is some inline `code` and a code block:

#raw(block: true, lang: "python",
"def hello():
    print('Hello, World!')")

#figure(
  image("/hello.jpg", width: 80%),
  caption: "A complex figure with an image."
)

#include "/other.typ"
```

```typ other.typ
= Additional Content

#figure(
  image("hello.jpg", width: 80%),
  caption: "Another view of the image."
)
```
:::
````

:::typst{mode="preview" height="250px"}

@file dest="/hello.jpg" src="/test.jpg"

```typ main.typ
= Code Example

Here is some inline `code` and a code block:

#raw(block: true, lang: "python",
"def hello():
    print('Hello, World!')")

#figure(
  image("/hello.jpg", width: 80%),
  caption: "A complex figure with an image and a table caption."
)

#include "/other.typ"

```

```typ other.typ
= Another Code Block

#figure(
  image("hello.jpg", width: 80%),
  caption: "A complex figure with an image and a table caption."
)
```
:::
