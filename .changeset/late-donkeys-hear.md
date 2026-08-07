---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Configure an element under `elements`, by the name you write it with.

What you put there is a default for the parameters of that element, used
wherever the element does not set that parameter itself:

```json
{
  "elements": {
    "sqlide": { "height": "500px" },
    "qr": { "size": "L" }
  }
}
```

This works for every element, not only the handful that read the configuration
themselves, because the defaults are filled in before the elements are read.

`cdn` serves the assets of an element from somewhere else instead of copying
them into your build:

```json
{
  "elements": {
    "sqlide": { "cdn": true }
  }
}
```

The elements carry the weight of a build, and they carry it unevenly. A book
with one SQL IDE is 23 MB, of which 21 MB is the SQL IDE; naming that one
element makes the build 1.9 MB. `true` serves them from jsDelivr, pinned to the
version of hyperbook that built the pages, so the assets always match the pages
that ask for them and never change for a build that was already published. A
URL serves them from a mirror of your own.

An element served this way needs the network, so leave it off for the ones you
want working offline. What belongs to no element stays in the build, as do the
translations, the search index and the favicons, which are built from your
hyperbook rather than shipped with hyperbook.
