---
name: Typst
permaid: typst
---

# Typst

The Typst browser compiler, renderer, JavaScript bundle, and standard fonts are included locally in the exported book. The CLI downloads and caches them the first time a build uses this element. Typst `@preview` packages and external resources referenced by your document still need a network connection.

The Typst directive allows you to render [Typst](https://typst.app/) documents directly in your hyperbook. Typst is a modern markup-based typesetting system that is easy to learn and produces beautiful documents.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `id` | Unique identifier for the Typst block | Auto-generated |
| `mode` | Display mode: `preview` (view only) or `edit` (with editor) | `preview` |
| `height` | Height of the preview container | `auto` |
| `main` | The file that is compiled | `main.typ` |
| `files` | What readers may do with files: `create`, `upload`, `rename`, `delete`, comma-separated, or `open` for all | `create,upload` |
| `accept` | Extensions of files readers create or rename, comma-separated | `.typ` |

## Important Notes

- **Multiple Typst Blocks**: When multiple Typst blocks are present on the same page, they render sequentially (one at a time) to ensure file isolation. Each block maintains its own independent file system during rendering.
- **File Isolation**: Files loaded in one Typst block (via `::file` or named code blocks) are completely isolated from other blocks on the same page. This means you can use the same filename (e.g., `other.typ`) in different blocks without conflicts.
- **Project Download**: When downloading a Typst project as ZIP, all referenced assets are automatically included:
  - Source files defined with named code blocks (e.g., `main.typ`, `helper.typ`)
  - Files added with `::file` (fonts excepted)
  - Files readers created or uploaded

  Images that the document only references by URL are not part of the ZIP; add them with `::file` to include them.


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

You can load files of your book with `::file` lines inside the `:::typst` block. Assets like images are automatically fetched from the server or from remote addresses.

#### Loading Source Files

Use `::file{path="…" src="…"}` to load Typst source files that can be included in your main document:

````md
:::typst{mode="preview"}

::file{path="other.typ" src="typst-doc.typ"}

```typ
= Main Document

#include "/other.typ"
```
:::
````

:::typst{id="ddcf9e8cb2be54d6b0f305d6f7a4608fd272aea84c5f0d92dbeda377b24e88bc" mode="preview"}

::file{path="other.typ" src="typst-doc.typ"}

```typ
= Main Document

#include "/other.typ"
```
:::

#### Loading Images

Images referenced in your Typst code are automatically loaded from the server or from remote URLs:

````md
:::typst{mode="preview"}

```typ
= Document with Image

#figure(
  image("my-image.jpg", width: 80%),
  caption: "My image"
)
```
:::
````

#### File Search Locations

Files referenced in the `src` attribute of `::file` and images referenced in `image()` calls are resolved as follows:

- **Absolute paths** (starting with `/`): The `basePath` is prepended to the path
- **Relative paths**: Resolved relative to the current page's directory (`pagePath`)

### Loading Fonts

Use `::file` with the `font` flag to load custom fonts for your Typst documents. Only `.otf` (OpenType) and `.ttf` (TrueType) fonts are supported.

````md
:::typst{mode="preview"}

::file{src="/fonts/FiraSans-Regular.otf" font}

```typ
#set text(font: "Fira Sans")

= Custom Font Example

This text uses the Fira Sans font.
```
:::
````

#### Emoji Support

For emoji support in Typst, you need to load the NotoColorEmoji font:

````md
:::typst{mode="preview"}

::file{src="/fonts/NotoColorEmoji.ttf" font}

```typ
= Emoji Example

Hello World! 🎉🚀✨
```
:::
````

#### Reusing Fonts with Snippets

For reusing fonts across many Typst instances, it is recommended to create a snippet. Create a file `fonts.md.hbs` in the `snippets` folder:

```hbs
::file{src="/fonts/NotoColorEmoji.ttf" font}
::file{src="/fonts/FiraSans-Regular.otf" font}
```

Then use the snippet in your Typst blocks:

````md
:::typst

::snippet{#fonts}

```typ
#set text(font: "Fira Sans")

= Document with Custom Fonts

This text uses Fira Sans and supports emojis! 🎉
```

:::
````

#### Multiple Source Files

You can define multiple source files by using named code blocks:

````md
:::typst{mode="preview"}

```typ
= Main Document

#include "/helper.typ"
```

```typ file="helper.typ"
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

This example demonstrates loading source files with multiple named Typst files:

````md
:::typst{mode="preview" height="250px"}

```typ
= Code Example

Here is some inline `code` and a code block:

#raw(block: true, lang: "python",
"def hello():
    print('Hello, World!')")

#figure(
  image("/test.jpg", width: 80%),
  caption: "A complex figure with an image."
)

#include "/other.typ"
```

```typ file="other.typ"
= Additional Content

#figure(
  image("/test.jpg", width: 80%),
  caption: "Another view of the image."
)
```
:::
````

:::typst{id="41090e9fba09270ee375e582062d9d143600dc175c9b67c995036efe2db85924" mode="preview" height="250px"}

```typ file="main.typ"
= Code Example

Here is some inline `code` and a code block:

#raw(block: true, lang: "python",
"def hello():
    print('Hello, World!')")

#figure(
  image("/test.jpg", width: 80%),
  caption: "A complex figure with an image."
)

#include "/other.typ"

```

```typ file="other.typ"
= Another Code Block

#figure(
  image("/test.jpg", width: 80%),
  caption: "A complex figure with an image."
)
```
:::

## Files readers may change

With `files`, readers get buttons for their own files: **+** creates a file, **⤒** uploads one, and each tab gets **✎** to rename and **×** to delete it. `rename` and `delete` allow it for the files of the page too; the main file and `readonly`, `hidden` and test files always stay as written. Files readers created or uploaded they can always rename and delete. Clicking the tab of a binary file shows a preview: images, audio and video, PDFs, fonts (TTF, OTF, WOFF) and 3D models (STL, OBJ), which you can turn and zoom.

````md
:::typst{files="create,upload,rename,delete"}
...
:::
````

## Upgrading from the old syntax

Older books loaded files with `@source`, `@file` and `@font` lines and named code blocks by their bare meta (```` ```typ other.typ ````). Run `npx hyperbook migrate` in your book to convert these pages and the snippets they use; it also keeps the documents readers saved.
