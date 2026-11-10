---
"hyperbook": minor
"@hyperbook/markdown": minor
"@hyperbook/types": minor
"hyperbook-studio": patch
---

`::pdf` builds Typst documents: `::pdf[Worksheet]{src="worksheet.typ"}` compiles the document into a PDF during the build and shows it like any other. `inputs="solution=true"` passes values to the document (each set of inputs is its own PDF). Documents are compiled with the official Typst compiler, which Hyperbook downloads and checks on first use; `typst.version` in `hyperbook.json` pins it (0.15.0 and newer are supported), `typst.packagePath` names a folder of the book's own packages (`@local/…`), and `typst.fontPath` a folder of fonts. `HYPERBOOK_TYPST_PACKAGE_PATH` adds packages shared by several books. The book's root is Typst's root, so imports and images work from anywhere in the book and nothing outside it is read. An unchanged document is not compiled again, a document with errors fails the build with Typst's message, and the dev server compiles documents as pages show them.

**Behaviour change:** `.typ` files are no longer copied into the site. A page that offers one for download with `:download[…]{src="file.typ"}` still gets it; a plain Markdown link to a `.typ` file now breaks, and `hyperbook check` reports it. `:::typst` blocks are not affected.
