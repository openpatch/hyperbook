---
"@hyperbook/types": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Fix `mailto:` and `tel:` links in markdown. `makeUrl` only passed through URLs
containing `://` or starting with `data:`, so `[Write us](mailto:a@b.c)` was
resolved against the base path and became `href="/mailto:a@b.c"`. Any URL with
a scheme is now passed through untouched.
