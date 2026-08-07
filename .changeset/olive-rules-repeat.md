---
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Rework how bookmarks store their label, so bookmarks show what the page shows.

A bookmark label used to be baked into an `onclick` attribute of the bookmark
button and rendered with `innerHTML`. Labels are now read from the rendered
heading when a bookmark is saved, and stored as parts instead of markup:

```js
[{ text: "Getting started " }, { text: "🐧", emoji: "1f427" }];
```

The bookmark list builds its entries from those parts with the DOM, so nothing
that was stored is parsed as HTML, and an emoji that is rendered as an image
stays an image in the bookmark list. Emojis are stored by id, never by URL, so
bookmarks survive a change of the `basePath`.

This also fixes bookmarking a heading that contains a quote or a backslash.
Those characters ended up inside a JavaScript string in the `onclick`
attribute and made the button throw a syntax error.

Breaking:

- `hyperbook.ui.toggleBookmark(key, label)` no longer takes a label:
  `hyperbook.ui.toggleBookmark(key)`. The label comes from the heading.
- Bookmark buttons no longer carry an inline `onclick`. They are handled by a
  delegated listener and carry `data-key`, `data-label` and `aria-pressed`.
- The store moves to version 6. Labels of existing bookmarks are migrated to
  the new shape, and a plain label is still rendered, so nothing is lost.
