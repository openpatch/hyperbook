---
"hyperbook": minor
"@hyperbook/fs": minor
"@hyperbook/types": minor
"hyperbook-studio": patch
---

`hyperbook.json` has a new `exclude` setting: globs for files that must not be part of the built site, for example `["intern/**", "**/*.draft.*"]`. They are matched against the address a file would have in the site and apply to the files in `public/` and to everything in `book/` and `glossary/` that is not a page. The dev server does not serve such files either, and `hyperbook check` reports links that point at them.
