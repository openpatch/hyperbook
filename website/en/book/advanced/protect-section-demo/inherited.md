---
name: Inherited Page
lang: en
---

# Inherited Page

This page has no `protect` in its frontmatter:

```md
---
name: Inherited Page
---
```

It is protected anyway, because the section around it is. That is the point of
putting `protect` on a section: you set the password once, and every page you
add to the folder afterwards is covered without you having to remember.

Unlocking is per declaring page or section, not per page — the section index
and this page share one, so entering the password there opened this page too.
Add ten more pages to the folder and they all open with the same entry.

## Turning it off for one page

Inheritance only fills in a `protect` that is not already there. A page can
take a different password:

```md
---
name: Public Notes
protect: something-else
---
```

There is no way to make a single page public again inside a protected section.
If you need that, move the page out of the folder.
