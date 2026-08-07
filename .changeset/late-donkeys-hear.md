---
"@hyperbook/types": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Add `assets.cdn`, for serving the assets of an element from a CDN instead of
copying them into every build. Name the elements you want it for:

```json
{
  "assets": {
    "cdn": ["onlineide", "sqlide", "emoji"]
  }
}
```

They are served from jsDelivr, pinned to the version of hyperbook that built
the pages, so the assets always match the pages that ask for them and never
change for a build that was already published. `assets.cdnUrl` serves them from
a mirror of your own instead.

The elements carry the weight of a build, and they carry it unevenly: a book
with one SQL IDE goes from 23 MB to 1.9 MB by naming that one element. Naming
none, which is the default, changes nothing.

Everything else stays in your build. The shell, the stylesheets and the maths
are the same for every hyperbook but small, and the translations, the search
index and the favicons are built from your hyperbook rather than shipped with
hyperbook. An element you name needs the network, so leave out the ones you
want working offline.
