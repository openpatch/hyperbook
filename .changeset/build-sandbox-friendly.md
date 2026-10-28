---
"@hyperbook/fs": patch
"hyperbook": patch
---

`hyperbook build` runs under Node's permission model with access to just the book and the CLI: files are copied without `fs.cp`, which read every parent directory of the output up to `/`. The `language` setting only loads a search stemmer when it is a bare language code such as `de`.
