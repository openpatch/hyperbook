---
name: Typst
permaid: typst
---

# Typst

The Typst directive allows you to render [Typst](https://typst.app/) documents directly in your hyperbook. Typst is a modern markup-based typesetting system that is easy to learn and produces beautiful documents.

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

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `mode` | Display mode: `preview` (view only) or `edit` (with editor) | `preview` |
| `height` | Height of the preview container. Accepts CSS values like `100px`, `50vh`, `calc(100dvh - 200px)` | `auto` for preview, `calc(100dvh - 128px)` for edit |
| `src` | Path to an external `.typ` file to load | - |

### Loading from External File

You can load Typst code from an external file using the `src` attribute:

````md
:::typst{mode="preview" src="document.typ"}
:::
````

The file is searched in the following locations (in order):
1. `public/` directory
2. `book/` directory
3. Current page's directory

## Examples

### Mathematical Formulas

:::typst{mode="preview" height=300}

```typ
= Mathematical Formulas

Typst supports beautiful mathematical typesetting:

$ integral_0^infinity e^(-x^2) dif x = sqrt(pi)/2 $

The quadratic formula:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $
```

:::

### Tables

:::typst{mode="preview" height=250}

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

### Code Blocks

:::typst{mode="preview" height=200}

```typ
= Code Example

Here is some inline `code` and a code block:

#raw(block: true, lang: "python",
"def hello():
    print('Hello, World!')")
```

:::
