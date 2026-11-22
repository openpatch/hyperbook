---
"@hyperbook/markdown": patch
---

Custom heading ids are applied again. `# Stable H1 {#stable}` rendered `id="stable-h1"` and linked to the generated anchor, so the id the documentation promises never reached the page. The heading anchor, the bookmark key, the table of contents, the search index and the share dialog now use the id as written, which is what makes a link survive a change of the heading text. Whitespace in a custom id is joined with `-`, because an id cannot contain a space.
