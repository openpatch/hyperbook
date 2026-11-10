---
name: PDF
permaid: pdf
---

# PDF

Shows a PDF document on the page: a script, a worksheet, a set of slides.
The pages are drawn in the browser, so they also work on tablets and phones,
where an embedded PDF usually shows only its first page. The text can be
selected, searched and read aloud.

```md
::pdf[Worksheet]{src="/example.pdf"}
```

::pdf[Worksheet]{src="/example.pdf"}

The text inside `[]` is the title. Without JavaScript the element is a link
to the file.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `src` | Path to the PDF. A path starting with a slash is looked up from the book's root (the `public` and `book` folders), any other path next to the page. | - |
| `view` | How the document is shown: `pages`, `slides`, `thumb`, `embed` or `button`, see below. | `pages` |
| `pages` | The pages to show, for example `1-2` or `3,5-6`. `4-` runs to the last page. | all |
| `download` | `false` hides the download button. | `true` |
| `height` | The height of the `slides` and `embed` views, for example `400` or `60vh`. | fits the page |

## Views

### pages

All pages below each other, as wide as the text. This is the default. Pages
are drawn when they scroll into view, so a long document does not slow the
page down.

```md
::pdf[Worksheet, pages 2 and 3]{src="/example.pdf" pages="2-3"}
```

::pdf[Worksheet, pages 2 and 3]{src="/example.pdf" pages="2-3"}

### slides

One page at a time, with buttons for the previous and the next page and for
fullscreen. With the focus on the document the arrow keys turn the pages; on a
touch screen a swipe does.

```md
::pdf[Slides]{src="/example-slides.pdf" view="slides"}
```

::pdf[Slides]{src="/example-slides.pdf" view="slides"}

### thumb

The first page as a small picture beside the title and the download button.
A click on the picture opens the document.

```md
::pdf[Worksheet]{src="/example.pdf" view="thumb"}
```

::pdf[Worksheet]{src="/example.pdf" view="thumb"}

### embed

The browser's own PDF viewer in a frame, with its zoom, search and print.
Use it for desktop readers only: most mobile browsers show just the first
page of an embedded PDF, or start a download.

```md
::pdf[Worksheet]{src="/example.pdf" view="embed" height="500"}
```

### button

Only a download button, like [download](/elements/download).

```md
::pdf[Worksheet (PDF)]{src="/example.pdf" view="button"}
```

::pdf[Worksheet (PDF)]{src="/example.pdf" view="button"}

## Typst documents

`src` can also name a [Typst](https://typst.app) document. The build turns it
into a PDF, which is then shown like any other:

```md
::pdf[Worksheet]{src="worksheet.typ"}
::pdf[Solution]{src="worksheet.typ" inputs="solution=true"}
```

- The document is compiled with the book's root as Typst's root, so
  `#import "/templates/header.typ"` and images work from anywhere in the book,
  and nothing outside the book can be read.
- `inputs` passes values to the document, read with
  `sys.inputs.at("solution", default: "false")`. Each set of inputs is its own
  PDF.
- A `.typ` file itself is never published, unless a page offers it with
  [download](/elements/download): `:download[Template]{src="template.typ"}`.
  To offer the PDF for download only, use `view="button"`.
- An unchanged document is not compiled again. A document that does not
  compile fails the build, with Typst's message.
- The dev server compiles a document when a page shows it.

Which Typst version builds the book, and where its packages and fonts are, is
set in `hyperbook.json`:

```json
{
  "typst": {
    "version": "0.15.1",
    "packagePath": "typst-packages",
    "fontPath": "fonts"
  }
}
```

| Option | Description |
|---|---|
| `version` | The Typst version, one of those Hyperbook supports (0.15.0 and newer). Hyperbook downloads it on first use. Without it the newest is used, with a warning: pin it, so the book builds the same way later. |
| `packagePath` | A folder in the book with Typst packages, laid out as `<namespace>/<name>/<version>/`. `@local/<name>:<version>` imports come from `local/`; Typst Universe packages the book carries go in `preview/`. Other `@preview` packages are downloaded by Typst. |
| `fontPath` | A folder in the book with fonts. Fonts installed on the computer are not used, so the book looks the same everywhere. |

Packages shared by several books can live in one folder outside them: set the
environment variable `HYPERBOOK_TYPST_PACKAGE_PATH` to it. A package in the
book's own `packagePath` wins over a shared one of the same name and version.
`HYPERBOOK_TYPST_BINARY` uses another `typst` binary than the downloaded one.

## What `pages` and `download` do not do

:::alert{warn}
`pages` and `download="false"` change what is shown, not what is published.
The browser loads the whole file to show two pages of it, and the file's
address is in the page. A worksheet with the solution on its last page gives
the solution to everyone who opens the file. Keep solutions in a document of
their own. The same holds inside a [protect](/elements/protect) block: it
hides the viewer, not the file.
:::

Files that must not be part of the site at all can be kept out with
[`exclude`](/configuration/book).

## Configuration

The viewer ([pdf.js](https://mozilla.github.io/pdf.js/)) is downloaded once and
copied into your book. To load it from a CDN instead, set `cdn` to `true`, or
to the address of your own copy:

```json
{
  "elements": {
    "pdf": {
      "cdn": true
    }
  }
}
```
