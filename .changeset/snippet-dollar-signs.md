---
"@hyperbook/fs": patch
"hyperbook": patch
---

Fix snippets whose content contains dollar signs, such as spreadsheet references like `$B2` or a lone `` `$` ``. The rendered snippet was inserted with a replacement string, so `` $` ``, `$&`, `$'` and `$$` were expanded as special patterns — `` $` `` pasted the whole page before the snippet into it again, which showed up as nested blocks. Snippets are now inserted literally.
