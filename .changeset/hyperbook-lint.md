---
"hyperbook": minor
"@hyperbook/markdown": minor
---

New `hyperbook lint` command finds problems in a book's pages without building it, so authors and AI agents can check what they wrote. It reports unknown elements (with a "did you mean"), elements that are never closed, element lines that could not be read (like `:: youtube`), stray `:::`, attributes an element does not read (`titel=` instead of `title=`) or values it does not know, files that `src`, `poster` and the like point at but that are not in the book, broken links and everything the elements report themselves. Every finding has a rule id. `--json` prints the findings for scripts and agents, and paths limit it to the pages you changed. `hyperbook build` and `hyperbook dev` now warn about all of these too. Before, an unknown element like `:::alret` quietly dropped its content from the page.
