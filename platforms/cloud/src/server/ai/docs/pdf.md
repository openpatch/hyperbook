# pdf

`::pdf[Title]{src="…"}` shows a PDF document on the page. It is a leaf
directive (one line, two colons); the text in `[]` is the title and the
download button's label.

    ::pdf[Arbeitsblatt]{src="arbeitsblatt.pdf"}
    ::pdf[Folien]{src="folien.pdf" view="slides"}
    ::pdf[Aufgaben]{src="arbeitsblatt.pdf" pages="1-2"}

`src` may also be a Typst document (`.typ`): the build compiles it into a PDF.
`inputs` passes values the document reads with
`sys.inputs.at("loesung", default: "false")`; each set of inputs is its own PDF.

    ::pdf[Arbeitsblatt]{src="arbeitsblatt.typ"}
    ::pdf[Lösung]{src="arbeitsblatt.typ" inputs="loesung=true"}

Attributes:

- `view`: `pages` (default, all pages below each other), `slides` (one page,
  previous/next, fullscreen), `thumb` (first page small beside the title),
  `embed` (the browser's own viewer; desktop only), `button` (only a
  download button).
- `pages`: the pages shown, e.g. `1-2`, `3,5-6`, `4-`.
- `download`: `false` hides the download button.
- `height`: height of `slides` and `embed`, e.g. `400` or `60vh`.
- `inputs`: `key=value` pairs, comma-separated; only for `.typ`.

Conventions that matter:

- `pages` and `download="false"` hide nothing: the whole file is published.
  Put solutions in a document of their own, not on the last page.
- A `.typ` file is never published by itself. To offer the source for
  download, use `:download[Vorlage]{src="vorlage.typ"}`; to offer only the
  PDF, `::pdf[…]{src="x.typ" view="button"}`.
- Do not write `:::pdf` (container) or `:pdf` (text): it is always `::pdf`.
- Typst settings live in `hyperbook.json` under `typst`: `version`,
  `packagePath` (a folder of `@local` packages), `fontPath`.
