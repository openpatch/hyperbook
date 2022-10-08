---
"@hyperbook/markdown": minor
---

We now remove HTML comments from your Markdown files. The comments will be
completely removed from the HTML output. So you can use these for adding hints
for your co-authors, or removing a section of your book from the output, but
not from the source code.

HTML comments also work across multiple lines. Here you can see an example:

```md
<!-- This is a HTML comment -->

<!--
  It
  also
  works
  across
  multiple
  lines
-->
```
