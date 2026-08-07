---
"@hyperbook/types": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Add `assets.cdn`, for serving the stylesheets and the scripts of the elements
from somewhere else instead of copying them into every build.

```json
{
  "assets": {
    "cdn": true
  }
}
```

`true` serves them from jsDelivr, pinned to the version of hyperbook that built
the pages, so they always match and never change for a build that was already
published. A URL serves them from a mirror of your own.

A build then only writes what belongs to your hyperbook: its pages, its own
files, its translations, its search index and its favicons. Those are written
either way, because they are built from your hyperbook and not shipped with
hyperbook.

Leave it off, which is the default, to keep a hyperbook working without the
network.
