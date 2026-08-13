---
name: Protected Page Demo
protect: demo
lang: en
---

# Protected Page Demo

You are through. Everything on this page was encrypted until you entered the
password.

Notice what was visible before that:

- the page name in the navigation, with a lock next to it
- the breadcrumb and the page title in the browser tab
- nothing else — not this heading, and not the table of contents

That is the difference between a page-level `protect` and a
[protect block](/elements/protect). A block hides a part of a page you can
otherwise read. Page-level protection hides the page.

## The frontmatter behind this page

```md
---
name: Protected Page Demo
protect: demo
---

# Protected Page Demo

...
```

`demo` is a name from the [password registry](/configuration/passwords) of this
documentation, which is committed on purpose so these demos work:

```json
{
  "passwords": {
    "demo": {
      "value": "hyperbook",
      "name": "Documentation demo",
      "description": "Opens the protection demos. Published on purpose."
    }
  }
}
```

If you would rather not keep a registry, write the password into the page
instead:

```md
---
name: Protected Page Demo
protect:
  password: hyperbook
  description: The password is the name of this project.
---
```

## What else this page is kept out of

Search this documentation for **"You are through"** — the phrase at the top of
this page. You will not find it. Protected pages contribute nothing to the
search index, which stores the full text of everything it indexes.

The same goes for `llms.txt`, and for the table of contents: the headings on
this page are inside the encrypted content, so there is nothing to build a
table of contents from.

## Next

See [Protected Section Demo](/advanced/protect-section-demo) for what happens
when a whole folder is protected.
