---
"@hyperbook/fs": patch
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix missing handlebars helpers (like `dateformat`) in pagelist custom snippets. The basic helpers are now properly registered when using custom snippet templates with the pagelist directive.
